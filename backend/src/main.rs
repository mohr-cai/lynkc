use lynkc_backend::run;

#[tokio::main]
async fn main() {
    if let Err(err) = run().await {
        eprintln!("backend failed: {err}");
    }
}
