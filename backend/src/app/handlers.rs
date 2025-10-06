use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use tracing::instrument;

use crate::{
    channel::{deserialize_channel, generate_channel_id, serialize_channel, validate_channel_data, ChannelData, ChannelFile},
    error::AppError,
    state::{refresh_ttl, SharedState},
};

#[instrument(skip_all)]
pub async fn health_check() -> &'static str {
    "ok"
}

#[derive(Deserialize, Default)]
pub struct CreateChannelRequest {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub files: Vec<ChannelFile>,
}

#[derive(Serialize)]
pub struct CreateChannelResponse {
    pub id: String,
    pub ttl_seconds: u64,
}

#[derive(Serialize)]
pub struct ChannelPayloadResponse {
    pub id: String,
    pub text: String,
    pub files: Vec<ChannelFile>,
    pub ttl_seconds: i64,
}

#[derive(Deserialize)]
pub struct UpdateChannelRequest {
    pub text: String,
    #[serde(default)]
    pub files: Vec<ChannelFile>,
}

#[instrument(level = "debug", skip(state, payload))]
pub async fn create_channel(
    State(state): State<SharedState>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<(StatusCode, Json<CreateChannelResponse>), AppError> {
    let id = generate_channel_id();
    let data = ChannelData {
        text: payload.text.unwrap_or_default(),
        files: payload.files,
    };

    validate_channel_data(&data)?;
    let serialized = serialize_channel(&data)?;

    let key = state.channel_key(&id);
    let mut conn = state.redis();
    let _: () = conn.set_ex(&key, serialized, state.ttl_seconds()).await?;

    Ok((
        StatusCode::CREATED,
        Json(CreateChannelResponse {
            id,
            ttl_seconds: state.channel_ttl().as_secs(),
        }),
    ))
}

#[instrument(level = "debug", skip(state))]
pub async fn fetch_channel(
    Path(id): Path<String>,
    State(state): State<SharedState>,
) -> Result<Json<ChannelPayloadResponse>, AppError> {
    let key = state.channel_key(&id);
    let mut conn = state.redis();

    let raw: Option<String> = conn.get(&key).await?;
    let Some(raw) = raw else {
        return Err(AppError::ChannelNotFound);
    };

    let data = deserialize_channel(raw);

    let ttl_seconds = conn
        .ttl(&key)
        .await
        .unwrap_or(state.channel_ttl().as_secs() as i64);

    refresh_ttl(&state, &key).await?;

    Ok(Json(ChannelPayloadResponse {
        id,
        text: data.text,
        files: data.files,
        ttl_seconds,
    }))
}

#[instrument(level = "debug", skip(state, payload))]
pub async fn update_channel(
    Path(id): Path<String>,
    State(state): State<SharedState>,
    Json(payload): Json<UpdateChannelRequest>,
) -> Result<StatusCode, AppError> {
    let key = state.channel_key(&id);
    let mut conn = state.redis();

    let exists: bool = conn.exists(&key).await?;
    if !exists {
        return Err(AppError::ChannelNotFound);
    }

    let data = ChannelData {
        text: payload.text,
        files: payload.files,
    };

    validate_channel_data(&data)?;
    let serialized = serialize_channel(&data)?;

    let _: () = conn.set_ex(&key, serialized, state.ttl_seconds()).await?;

    Ok(StatusCode::NO_CONTENT)
}
