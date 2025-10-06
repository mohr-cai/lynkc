# lynkc

> **Clipboard relays over TLS 1.3 + Redis Streams.** LYNKC pipes your clipboard through a Rust/Tokio backend with Redis fan-out for scale.

## Why

- Copy/paste into remote shells, air-gapped boxes, or throwaway VMs without trusting extra tooling.
- Spin up a channel, drop text or whole files (up to ~100 MB), share the ID, and everyone stays in sync.
- Nothing hits disk: payloads live in Redis with a sliding TTL, vanish when idle, and containers stay stateless.

## Stack Snapshot

| Layer      | What we use | Why it fits |
|------------|-------------|-------------|
| Web API    | Rust + Axum | Lean async server, predictable perf, native Redis client |
| Cache      | Redis       | Ephemeral key/value, TTL per channel, zero persistence |
| Frontend   | Vite + React + shadcn/ui | Minimal build, solid DX, dark-mode vibes |
| Runtime    | Docker (optional) | One-liner spin-up for backend + Redis |

## Flow

1. Hit the UI, mash “Generate brand new” or punch in a channel ID, then copy the share link for your unlucky teammate.
2. Type or drop files; lynkc snapshots the payload, base64s attachments, and ships it to the backend.
3. Everyone polling the same ID sees updates instantly; TTL refreshes on read/write and disappears when quiet.

## Run It

### Quickstart (Docker)
```bash
cp .env.example .env
# tweak ports/redis uri as needed

docker compose up --build
```
Backend boots on `${BACKEND_HOST}:${BACKEND_PORT}` (default `0.0.0.0:8080`), Redis on `${REDIS_PORT}`.

### Bare-metal dev
```bash
# backend
cd backend
# env lives at repo root `.env`
cargo run

# frontend
cd ../frontend
npm install
npm run dev
```
Build the static site with `npm run build`; serve `frontend/dist/` using whatever Nginx/Caddy you already trust.

## Env knobs

- `HOST` / `PORT` (or `BIND_ADDRESS`) – listen address for the API.
- `REDIS_URL` – upstream cache; should point at something with persistence disabled.
- `CHANNEL_TTL_SECONDS` – default 900 (15 min). Every fetch resets the clock.
- Frontend reads the same root `.env` (via Vite) for `VITE_*` variables like `VITE_API_BASE_URL`.

All payloads are capped at ~100 MB (text + attachments). Oversize requests get a `400 PayloadTooLarge` with nothing stored.

---

Bring your own HTTPS termination if you want clipboard APIs to behave on remote machines.
