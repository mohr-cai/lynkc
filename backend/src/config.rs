use std::{net::SocketAddr, path::Path, time::Duration};

use crate::error::AppError;

pub const DEFAULT_CHANNEL_TTL_SECONDS: u64 = 15 * 60; // 15 minutes
pub const MAX_CHANNEL_BYTES: usize = 100 * 1024 * 1024; // 100 MiB
pub const MAX_REQUEST_BYTES: usize = 200 * 1024 * 1024; // allow headroom for base64 expansion

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub bind_address: SocketAddr,
    pub redis_url: String,
    pub channel_ttl: Duration,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, AppError> {
        Self::load_env_file();

        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

        let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = std::env::var("PORT")
            .ok()
            .and_then(|raw| raw.parse::<u16>().ok())
            .unwrap_or(8080);

        let bind_address = std::env::var("BIND_ADDRESS")
            .map(|raw| raw.parse().map_err(AppError::BindAddress))
            .unwrap_or_else(|_| {
                format!("{host}:{port}")
                    .parse()
                    .map_err(AppError::BindAddress)
            })?;

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

    fn load_env_file() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        if let Some(workspace_root) = manifest_dir.parent() {
            let root_env = workspace_root.join(".env");
            if dotenvy::from_path(&root_env).is_ok() {
                return;
            }
        }

        dotenvy::dotenv().ok();
    }
}
