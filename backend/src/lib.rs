pub mod app;
pub mod channel;
pub mod config;
pub mod error;
pub mod state;

use app::build_router;
use config::AppConfig;
use error::AppError;
use state::{shared, AppState};
use tokio::net::TcpListener;
use tracing::info;

pub async fn run() -> Result<(), AppError> {
    init_tracing();

    let config = AppConfig::from_env()?;
    let state = AppState::initialise(&config).await?;
    let shared_state = shared(state);

    let router = build_router(shared_state);

    let listener = TcpListener::bind(config.bind_address).await?;
    info!(addr = %config.bind_address, "starting lynkc backend");

    axum::serve(listener, router).await?;
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
