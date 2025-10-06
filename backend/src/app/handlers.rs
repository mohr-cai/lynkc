use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use tracing::instrument;

use crate::{
    channel::{
        deserialize_channel, generate_channel_id, generate_channel_password, hash_channel_password,
        serialize_channel, validate_channel_data, verify_channel_password, ChannelData, ChannelFile,
        StoredChannel,
    },
    error::AppError,
    state::{refresh_ttl, SharedState},
};

const CHANNEL_PASSWORD_HEADER: &str = "x-channel-password";

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
    pub password: String,
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
    let password = generate_channel_password();
    let password_hash = hash_channel_password(&password);
    let record = StoredChannel {
        password_hash: Some(password_hash),
        data,
    };
    let serialized = serialize_channel(&record)?;

    let key = state.channel_key(&id);
    let mut conn = state.redis();
    let _: () = conn.set_ex(&key, serialized, state.ttl_seconds()).await?;

    Ok((
        StatusCode::CREATED,
        Json(CreateChannelResponse {
            id,
            password,
            ttl_seconds: state.channel_ttl().as_secs(),
        }),
    ))
}

#[instrument(level = "debug", skip(state))]
pub async fn fetch_channel(
    Path(id): Path<String>,
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Result<Json<ChannelPayloadResponse>, AppError> {
    let provided_password = headers
        .get(CHANNEL_PASSWORD_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    let key = state.channel_key(&id);
    let mut conn = state.redis();

    let raw: Option<String> = conn.get(&key).await?;
    let Some(raw) = raw else {
        return Err(AppError::ChannelNotFound);
    };

    let record = deserialize_channel(raw);
    if !verify_channel_password(record.password_hash.as_deref(), provided_password.as_deref()) {
        return Err(AppError::InvalidChannelPassword);
    }

    let data = record.data;

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

#[instrument(level = "debug", skip(state, payload, headers))]
pub async fn update_channel(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<SharedState>,
    Json(payload): Json<UpdateChannelRequest>,
) -> Result<StatusCode, AppError> {
    let provided_password = headers
        .get(CHANNEL_PASSWORD_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    let key = state.channel_key(&id);
    let mut conn = state.redis();

    let raw: Option<String> = conn.get(&key).await?;
    let Some(raw) = raw else {
        return Err(AppError::ChannelNotFound);
    };
    let mut record = deserialize_channel(raw);
    if !verify_channel_password(record.password_hash.as_deref(), provided_password.as_deref()) {
        return Err(AppError::InvalidChannelPassword);
    }

    let data = ChannelData {
        text: payload.text,
        files: payload.files,
    };

    validate_channel_data(&data)?;
    record.data = data;
    let serialized = serialize_channel(&record)?;

    let _: () = conn.set_ex(&key, serialized, state.ttl_seconds()).await?;

    Ok(StatusCode::NO_CONTENT)
}
