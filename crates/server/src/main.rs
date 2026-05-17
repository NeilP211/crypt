//! Entry point: initialize observability, then hand off to the library.

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    crypt_server::observability::init_tracing();
    if let Err(error) = crypt_server::run().await {
        tracing::error!(%error, "crypt-server exited with an error");
        std::process::exit(1);
    }
    Ok(())
}
