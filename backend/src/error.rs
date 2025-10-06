use axum::{http::StatusCode, response::IntoResponse, Json};
use redis::RedisError;
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("failed to parse bind address: {0}")]
    BindAddress(std::net::AddrParseError),
    #[error("redis error: {0}")]
    Redis(#[from] RedisError),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("channel not found")]
    ChannelNotFound,
    #[error("invalid channel password")]
    InvalidChannelPassword,
    #[error("channel payload exceeds allowed size")]
    PayloadTooLarge,
    #[error("invalid file data encoding")]
    InvalidFileData,
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        tracing::error!(error = ?self, "request failed");
        let status = match self {
            AppError::ChannelNotFound => StatusCode::NOT_FOUND,
            AppError::InvalidChannelPassword => StatusCode::UNAUTHORIZED,
            AppError::PayloadTooLarge | AppError::InvalidFileData => StatusCode::BAD_REQUEST,
            AppError::BindAddress(_)
            | AppError::Redis(_)
            | AppError::Io(_)
            | AppError::Serialization(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (status, Json(ErrorResponse::from(self))).into_response()
    }
}

#[derive(Serialize)]
pub struct ErrorResponse {
    message: String,
}

impl From<AppError> for ErrorResponse {
    fn from(value: AppError) -> Self {
        Self {
            message: value.to_string(),
        }
    }
}
