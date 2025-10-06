# lynkc

lynkc is your copy-paste web application that syncs your clipboard via the browser, built as a minimal monorepo with a Rust backend, Redis cache, and React/Next.js frontend.

## Architecture

- `backend/`: Rust + Axum web server exposing ephemeral channel REST API backed by Redis. Stateless containers; channel payloads expire automatically.
- `frontend/`: Vite-powered React + shadcn/ui interface for creating/joining channels and sharing clipboard text in real time via polling.
- `docker-compose.yml`: Local orchestration of the backend API and Redis cache.

## Flow

1. Client creates or joins a channel ID via the frontend.
2. Frontend stores and retrieves channel text and file attachments via backend REST calls.
3. Backend stores channel payloads in Redis with TTL and serves them to all participants without persisting to disk.

## Development

- Backend: `cargo run` in `backend/` (requires Redis).
- Frontend: `npm run dev` in `frontend/`.
- Backend stack (API + Redis): `docker compose up`.

## Configuration

Copy `.env.example` to `.env` and tweak the values for your deployment targets.

- Backend honours `HOST`/`PORT` (or a combined `BIND_ADDRESS`) plus Redis/TTL values.
- Frontend uses `VITE_API_BASE_URL` during builds to wire API calls.
- Attachments are base64-encoded and capped at roughly ~100 MiB per channel (text + files).
- Docker Compose consumes the same `.env` file so container ports stay in sync with the binaries.

To run locally without Docker, you can place service-specific overrides in `backend/.env` and `frontend/.env.local`.

For production you can build the React app on your deployment target with `npm run build` and serve the generated `frontend/dist/` directory using your platform Nginx (no frontend container is provided).
