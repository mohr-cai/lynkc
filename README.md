# lynkc

lynkc is your copy-paste web application that syncs your clipboard via the browser, built as a minimal monorepo with a Rust backend, Redis cache, and React/Next.js frontend.

## Architecture

- `backend/`: Rust + Axum web server exposing ephemeral channel REST API backed by Redis. Stateless containers; channel payloads expire automatically.
- `frontend/`: Next.js + React + shadcn/ui interface for creating/joining channels and sharing clipboard text in real time via polling.
- `docker-compose.yml`: Local orchestration of web server, Redis, and frontend. Backend container exposes HTTP API; frontend proxies requests during development.

## Flow

1. Client creates or joins a channel ID via the frontend.
2. Frontend stores and retrieves channel text via backend REST calls.
3. Backend stores channel payloads in Redis with TTL and serves them to all participants without persisting to disk.

## Development

- Backend: `cargo run` in `backend/` (requires Redis).
- Frontend: `pnpm dev` in `frontend/`.
- Both services: `docker compose up`.

## Configuration

Copy `.env.example` to `.env` and tweak the values for your deployment targets.

- Backend honours `HOST`/`PORT` (or a combined `BIND_ADDRESS`) plus Redis/TTL values.
- Frontend uses `NEXT_PUBLIC_API_BASE_URL` during builds to wire API calls.
- Docker Compose consumes the same `.env` file so container ports stay in sync with the binaries.

To run locally without Docker, you can place service-specific overrides in `backend/.env` and `frontend/.env.local`.
