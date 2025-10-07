mod handlers;

pub use handlers::{
    ChannelPayloadResponse, CreateChannelRequest, CreateChannelResponse, UpdateChannelRequest,
    create_channel, delete_channel_file, fetch_channel, health_check, update_channel,
};

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{delete, get, post},
};
use tower_http::{cors::CorsLayer, limit::RequestBodyLimitLayer, trace::TraceLayer};

use crate::{config::MAX_REQUEST_BYTES, state::SharedState};

pub fn build_router(state: SharedState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/api/channels", post(create_channel))
        .route("/api/channels/:id", get(fetch_channel).put(update_channel))
        .route(
            "/api/channels/:id/files/:file_id",
            delete(delete_channel_file),
        )
        .layer(
            CorsLayer::new()
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::OPTIONS,
                ])
                .allow_origin(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any),
        )
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(MAX_REQUEST_BYTES))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
