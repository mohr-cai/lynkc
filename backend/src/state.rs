use std::{sync::Arc, time::Duration};

use redis::{aio::ConnectionManager, AsyncCommands};

use crate::{config::AppConfig, error::AppError};

#[derive(Clone)]
pub struct AppState {
    redis: ConnectionManager,
    channel_ttl: Duration,
}

impl AppState {
    pub async fn initialise(config: &AppConfig) -> Result<Self, AppError> {
        let client = redis::Client::open(config.redis_url.clone())?;
        let manager = ConnectionManager::new(client).await?;

        Ok(Self {
            redis: manager,
            channel_ttl: config.channel_ttl,
        })
    }

    pub fn redis(&self) -> ConnectionManager {
        self.redis.clone()
    }

    pub fn channel_key(&self, id: &str) -> String {
        format!("channel:{id}")
    }

    pub fn ttl_seconds(&self) -> usize {
        self.channel_ttl.as_secs() as usize
    }

    pub fn channel_ttl(&self) -> Duration {
        self.channel_ttl
    }
}

pub type SharedState = Arc<AppState>;

pub fn shared(state: AppState) -> SharedState {
    Arc::new(state)
}

pub async fn refresh_ttl(state: &SharedState, key: &str) -> Result<(), AppError> {
    let mut conn = state.redis();
    let _: () = conn.expire(key, state.ttl_seconds()).await?;
    Ok(())
}
