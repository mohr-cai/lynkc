# lynkc architecture sketch

This refactor mirrors the module structure used by larger Rust projects (think uv or Axum starters) and splits runtime concerns into small, testable pieces. The frontend mirrors that idea with feature folders and dedicated hooks.

## Backend layout

```
backend/src
├── main.rs             # CLI entrypoint; keeps runtime wiring only
├── lib.rs              # Re-exports `app::build_router` for tests
├── config.rs           # Environment parsing + limits
├── channel.rs          # Channel data types + validation helpers
├── error.rs            # Unified error type and HTTP mapping
├── state.rs            # Redis connection manager + TTL helpers
└── app
    ├── mod.rs          # `build_router` and tower layers
    └── handlers.rs     # create/fetch/update logic
```

Each handler gets state via typed extractors and returns domain structs. Validation lives in `channel.rs`, Redis plumbing stays in `state.rs`. `app::build_router` constructs layers (CORS, body limit, tracing) and can be reused in integration tests.

## Frontend layout

```
frontend/src
├── app/App.tsx         # Root route composed from feature widgets
├── features/channel
│   ├── ChannelShell.tsx    # top-level container
│   ├── ChannelSidebar.tsx  # join/create + status + share link
│   ├── ChannelPad.tsx      # text + attachments UI
│   ├── RemotePanel.tsx     # remote state and actions
│   └── hooks.ts            # polling + file helpers
├── components/ui        # shadcn primitives
├── lib
│   ├── api.ts           # fetch helpers
│   ├── files.ts         # base64 + payload math
│   └── state.ts         # types shared across widgets
└── styles/index.css
```

The feature folder keeps logic colocated (hooks, helpers, view components) and exports a single `ChannelShell` used by `App.tsx`. Files/clipboard utilities now live under `lib/files.ts` so other features could re-use them.
