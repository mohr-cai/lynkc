FROM rust:1.77 AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock* ./
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim
RUN useradd --create-home appuser
WORKDIR /home/appuser

COPY --from=builder /app/target/release/lynkc-backend /usr/local/bin/lynkc-backend

ENV RUST_LOG=info
EXPOSE 8080

USER appuser
CMD ["lynkc-backend"]
