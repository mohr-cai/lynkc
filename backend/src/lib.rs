use std::{net::SocketAddr, sync::Arc, time::Duration};

use axum::{
    extract::{Path, State},
    http::{Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use redis::{aio::ConnectionManager, AsyncCommands};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, instrument};
use uuid::Uuid;

const DEFAULT_CHANNEL_TTL_SECONDS: u64 = 900; // 15 minutes
const CHANNEL_KEY_PREFIX: &str = "channel:";

pub struct AppState {
    redis: ConnectionManager,
    channel_ttl: Duration,
}

impl AppState {
    async fn initialise(config: &AppConfig) -> Result<Self, AppError> {
        let client = redis::Client::open(config.redis_url.clone())?;
        let manager = ConnectionManager::new(client).await?;

        Ok(Self {
            redis: manager,
            channel_ttl: config.channel_ttl,
        })
    }

    fn redis(&self) -> ConnectionManager {
        self.redis.clone()
    }

    fn channel_key(&self, id: &str) -> String {
        format!("{CHANNEL_KEY_PREFIX}{id}")
    }

    fn ttl_seconds(&self) -> usize {
        self.channel_ttl.as_secs() as usize
    }
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub bind_address: SocketAddr,
    pub redis_url: String,
    pub channel_ttl: Duration,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, AppError> {
        dotenvy::dotenv().ok();

        let bind_address = std::env::var("BIND_ADDRESS")
            .unwrap_or_else(|_| "0.0.0.0:8080".to_string())
            .parse()
            .map_err(AppError::BindAddress)?;

        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

        let channel_ttl_seconds = std::env::var("CHANNEL_TTL_SECONDS")
            .ok()
            .and_then(|raw| raw.parse::<u64>().ok())
            .filter(|&ttl| ttl > 0)
            .unwrap_or(DEFAULT_CHANNEL_TTL_SECONDS);

        Ok(Self {
            bind_address,
            redis_url,
            channel_ttl: Duration::from_secs(channel_ttl_seconds),
        })
    }
}

#[derive(Deserialize, Default)]
pub struct CreateChannelRequest {
    #[serde(default)]
    initial_content: Option<String>,
}

#[derive(Serialize)]
pub struct CreateChannelResponse {
    id: String,
    ttl_seconds: u64,
}

#[derive(Serialize)]
pub struct ChannelPayloadResponse {
    id: String,
    content: String,
    ttl_seconds: i64,
}

#[derive(Deserialize)]
pub struct UpdateChannelRequest {
    content: String,
}

#[derive(Error, Debug)]
pub enum AppError {
    #[error("failed to parse bind address: {0}")]
    BindAddress(std::net::AddrParseError),
    #[error("redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("channel not found")]
    ChannelNotFound,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        tracing::error!(error = ?self, "request failed");
        let status = match self {
            AppError::ChannelNotFound => StatusCode::NOT_FOUND,
            AppError::BindAddress(_) | AppError::Redis(_) | AppError::Io(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (status, Json(ErrorResponse::from(self))).into_response()
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    message: String,
}

impl From<AppError> for ErrorResponse {
    fn from(value: AppError) -> Self {
        Self {
            message: value.to_string(),
        }
    }
}

type SharedState = Arc<AppState>;

pub async fn run() -> Result<(), AppError> {
    init_tracing();

    let config = AppConfig::from_env()?;
    let state = AppState::initialise(&config).await?;
    let shared_state = Arc::new(state);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/channels", post(create_channel))
        .route("/api/channels/:id", get(fetch_channel).put(update_channel))
        .layer(
            CorsLayer::new()
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::OPTIONS,
                ])
                .allow_origin(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(shared_state.clone());

    let listener = TcpListener::bind(config.bind_address).await?;
    info!(addr = %config.bind_address, "starting lynkc backend");

    axum::serve(listener, app).await?;

    Ok(())
}

fn init_tracing() {
    static INIT: std::sync::Once = std::sync::Once::new();
    INIT.call_once(|| {
        tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .with_target(false)
            .compact()
            .init();
    });
}

#[instrument(skip_all)]
async fn health_check() -> &'static str {
    "ok"
}

#[instrument(level = "debug", skip(state, payload))]
async fn create_channel(
    State(state): State<SharedState>,
    Json(payload): Json<CreateChannelRequest>,
) -> Result<impl IntoResponse, AppError> {
    let id = generate_channel_id();
    let content = payload.initial_content.unwrap_or_default();
    let key = state.channel_key(&id);

    let mut conn = state.redis();
    let _: () = conn.set_ex(&key, content, state.ttl_seconds()).await?;

    Ok((
        StatusCode::CREATED,
        Json(CreateChannelResponse {
            id,
            ttl_seconds: state.channel_ttl.as_secs(),
        }),
    ))
}

#[instrument(level = "debug", skip(state))]
async fn fetch_channel(
    Path(id): Path<String>,
    State(state): State<SharedState>,
) -> Result<impl IntoResponse, AppError> {
    let key = state.channel_key(&id);
    let mut conn = state.redis();

    let content: Option<String> = conn.get(&key).await?;
    let Some(content) = content else {
        return Err(AppError::ChannelNotFound);
    };

    let ttl_seconds = conn.ttl(&key).await.unwrap_or(state.channel_ttl.as_secs() as i64);
    let ttl_seconds = if ttl_seconds < 0 {
        state.channel_ttl.as_secs() as i64
    } else {
        ttl_seconds
    };

    // Refresh TTL when someone fetches the channel to keep it alive while active.
    let _: () = conn.expire(&key, state.ttl_seconds()).await?;

    Ok(Json(ChannelPayloadResponse {
        id,
        content,
        ttl_seconds,
    }))
}

#[instrument(level = "debug", skip(state, payload))]
async fn update_channel(
    Path(id): Path<String>,
    State(state): State<SharedState>,
    Json(payload): Json<UpdateChannelRequest>,
) -> Result<impl IntoResponse, AppError> {
    let key = state.channel_key(&id);
    let mut conn = state.redis();

    let exists: bool = conn.exists(&key).await?;
    if !exists {
        return Err(AppError::ChannelNotFound);
    }

    let _: () = conn.set_ex(&key, payload.content, state.ttl_seconds()).await?;

    Ok((StatusCode::NO_CONTENT, ()))
}

fn generate_channel_id() -> String {
    let raw = Uuid::new_v4().simple().to_string();
    raw[..8].to_string()
}

#[cfg(test)]
mod tests {
    use super::generate_channel_id;

    #[test]
    fn generated_channel_id_is_short_and_uniqueish() {
        let first = generate_channel_id();
        let second = generate_channel_id();
        assert_eq!(first.len(), 8);
        assert_ne!(first, second);
    }
}
