# anchornet-backend

**AnchorNet** API — routing, settlement, and liquidity indexer for the AnchorNet liquidity coordination network (Stellar anchors).

## Overview

- **Stack:** Node.js, Express, TypeScript
- **Role:** REST API for routing, settlement engine, and liquidity analytics

## Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

## Setup

```bash
# Clone the repo (or use your fork)
git clone <repo-url>
cd anchornet-backend

# Install dependencies
npm install

# Run in development
npm run dev
```

Server runs at `http://localhost:3001` by default. Set `PORT` to override.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm test` | Run tests (Jest) |
| `npm run lint` | Run ESLint |

## API

### Service

- `GET /health` – health check
- `GET /health/live` – liveness probe, always `200` while the process is up
- `GET /health/ready` – readiness probe, `200` normally and `503` once a
  graceful shutdown has begun (so a load balancer stops routing new traffic)
- `GET /api/v1/info` – API name and version
- `GET /api/v1/openapi.json` – hand-maintained OpenAPI-shaped description of
  every route below
- `GET /api/v1/audit` – the most recent mutating requests (method, path,
  status, request id, timestamp), last 200 in memory; sensitive fields/headers (such as `x-api-key`, `authorization`, `secret`) are automatically redacted via a denylist

### Liquidity

- `POST /api/v1/liquidity` – record liquidity `{ anchor, asset, amount }`; repeated
  contributions from the same anchor accumulate. Returns `201` with the entry.
- `POST /api/v1/liquidity/withdraw` – withdraw liquidity `{ anchor, asset, amount }`
  previously recorded by an anchor, mirroring the on-chain contract's
  `withdraw_liquidity`. Reduces the anchor's balance and removes the entry
  once it reaches zero. Returns `404` if the anchor holds no balance in the
  asset, or `400` (`INSUFFICIENT_LIQUIDITY`) if the amount exceeds it.
- `GET /api/v1/liquidity` – list aggregated pools `{ pools: [{ asset, total, anchors }] }`
- `GET /api/v1/liquidity/entries` – list raw per-anchor entries
- `GET /api/v1/liquidity/:asset` – aggregated pool for one asset (`404` if none)
- `DELETE /api/v1/liquidity/:anchor/:asset` – administratively remove an
  anchor's entire entry (`404` if none). This bypasses reserved-liquidity
  accounting checks, so operators should first confirm that no pending
  settlements depend on the entry.

### Routing

- `POST /api/v1/quote` – compute a routing quote `{ asset, amount }`. Selects
  anchor liquidity largest-first and applies the protocol fee, returning
  `{ asset, amount, fee, deliverable, route }`. When one anchor cannot cover
  the full amount, additional anchors are added until the amount is covered.
  Each entry in `route` contains `{ anchor, portion }` — the anchor identifier
  and the amount sourced from it. Returns `400` (`INSUFFICIENT_LIQUIDITY`) when
  the combined pool cannot cover the amount.

### Anchors

- `POST /api/v1/anchors` – register an anchor `{ id, name? }` (`409` if it exists)
- `POST /api/v1/anchors/bulk` – register a batch of anchors atomically
  `{ anchors: [{ id, name? }, ...] }`; validates and checks every entry (against
  both the existing registry and duplicates within the batch) before storing
  any of them, so one bad entry never leaves a partial batch registered
- `GET /api/v1/anchors` – list anchors; supports `?status=active` or
  `?status=inactive` (`400` for any other value), a free-text `?q=` search
  over `id`/`name` (case-insensitive substring match), `?sort=id|name|registeredAt`
  with `?order=asc|desc` (default `asc`), and `?format=csv` to export the
  (post-filter, post-sort) list as CSV instead of JSON
- `GET /api/v1/anchors/:id` – read one anchor (`404` if unknown)
- `PATCH /api/v1/anchors/:id` – partially update an anchor's mutable `name`
  (`404` if unknown, `400` if `name` is missing or blank)
- `DELETE /api/v1/anchors/:id` – deactivate an anchor
- `POST /api/v1/anchors/:id/reactivate` – reactivate a previously deactivated
  anchor (`404` if unknown)

### Anchor Settlements

- `GET /api/v1/anchors/:id/settlements` – list settlements scoped to a specific
  anchor (`404` if the anchor id is unknown); supports the same
  `?sort=id|amount|fee|status|createdAt`, `?order=asc|desc`, `?page=`,
  `?pageSize=`, and `?format=csv` params as `GET /api/v1/settlements`

### Settlements

- `POST /api/v1/settlements` – open a settlement `{ anchor, asset, amount }`,
  reserving liquidity. Returns `201` with the pending settlement.
- `GET /api/v1/settlements` – list settlements; supports `?anchor=`, `?asset=`,
  `?sort=id|amount|fee|status|createdAt` with `?order=asc|desc` (default
  `asc`), `?page=`, `?pageSize=`, and `?format=csv` (ignores pagination and
  exports every matching, sorted row)
- `GET /api/v1/settlements/:id` – read one settlement
- `POST /api/v1/settlements/:id/execute` – execute a pending settlement
- `POST /api/v1/settlements/:id/cancel` – cancel and release reserved
  liquidity; accepts an optional `{ reason }` recorded on the settlement

### Metrics

- `GET /api/v1/metrics` – aggregate counts (anchors, pools, liquidity,
  settlements). Each read also appends a timestamped snapshot to an in-memory
  rolling history (last 50 reads).
- `GET /api/v1/metrics/history` – the recorded metrics snapshots, oldest first
  (`{ snapshots: [...] }`)

Errors use a uniform envelope: `{ "error": { "code", "message" } }`, including
malformed JSON (`400`) and oversized request bodies (`413`,
`PAYLOAD_TOO_LARGE`). Every response carries an `x-request-id` header for
tracing, plus a small set of defensive security headers (`X-Content-Type-Options`,
`X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `X-DNS-Prefetch-Control`).

Mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) are rate-limited per client
(default 30 requests/minute, in-memory). When `API_KEY` authentication is
configured, the presented key identifies the client; open deployments continue
to use the client IP. Requests over the limit receive `429` with code
`RATE_LIMITED`. `POST /api/v1/quote` has an additional, stricter limit (10
requests/minute) on top of the general one.

Mutating requests may also send an `Idempotency-Key` header. The first request
for a given key/method/path combination runs normally and its response is cached; any
later request reusing the same key (within 24h) replays the original response
instead of re-running the handler, so retried requests don't double-apply
side effects (e.g. registering the same anchor twice). State is in-memory and
per-process.

#### Walkthrough Example

To verify how the idempotency system behaves, you can perform the following walkthrough using `curl`.

1. **Initial request:** Send a POST request to register an anchor with a unique `Idempotency-Key` header. The server processes this request normally and returns a `201` status code:

   ```bash
   curl -i -X POST http://localhost:3001/api/v1/anchors \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: register-anchor-xyz" \
     -d '{"id": "anchor-xyz", "name": "Anchor XYZ"}'
   ```

   Response:
   ```http
   HTTP/1.1 201 Created
   Content-Type: application/json; charset=utf-8
   x-request-id: df743737-896c-4e4f-8dae-1c08a95302cd

   {
     "id": "anchor-xyz",
     "name": "Anchor XYZ",
     "registeredAt": "2026-07-22T14:17:57.537Z",
     "active": true
   }
   ```

2. **Subsequent replay:** Send the exact same request again using the same `Idempotency-Key`. The server returns the cached `201` response immediately, bypassing the normal handler and avoiding a `409` (which would normally happen for duplicate anchor registration):

   ```bash
   curl -i -X POST http://localhost:3001/api/v1/anchors \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: register-anchor-xyz" \
     -d '{"id": "anchor-xyz", "name": "Anchor XYZ"}'
   ```

   Response (Cached):
   ```http
   HTTP/1.1 201 Created
   Content-Type: application/json; charset=utf-8
   x-request-id: 4a123f52-1623-429b-ba67-3d0d0d5c2eb0

   {
     "id": "anchor-xyz",
     "name": "Anchor XYZ",
     "registeredAt": "2026-07-22T14:17:57.537Z",
     "active": true
   }
   ```

3. **Mismatched body (Known Gap):** If you reuse the same `Idempotency-Key` but change the request payload (e.g., modifying the `name` field), the server will still return the cached `201` response corresponding to the first payload. Detecting mismatched request bodies (which would ideally return a `422` error) is currently a known gap in this system.

   ```bash
   curl -i -X POST http://localhost:3001/api/v1/anchors \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: register-anchor-xyz" \
     -d '{"id": "anchor-xyz", "name": "Anchor XYZ Modified Name"}'
   ```

   Response (Replayed from the original cached version):
   ```http
   HTTP/1.1 201 Created
   Content-Type: application/json; charset=utf-8
   x-request-id: 184c8357-3fc3-4e2f-a87c-19042ab804fe

   {
     "id": "anchor-xyz",
     "name": "Anchor XYZ",
     "registeredAt": "2026-07-22T14:17:57.537Z",
     "active": true
   }
   ```

The process shuts down gracefully on `SIGTERM`/`SIGINT`: it stops accepting
new connections, closes the HTTP server, marks `/health/ready` unready, and
force-exits if it hasn't closed within 10 seconds.

Responses are gzip-compressed when the client sends `Accept-Encoding: gzip`
and the body is large enough to benefit.

When `MAINTENANCE_MODE` is enabled, every mutating request (`POST`/`PUT`/`PATCH`/`DELETE`)
is rejected with `503` (`SERVICE_UNAVAILABLE`) while reads keep working, so
operators can pause writes without taking the whole API down.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `FEE_BPS` | `10` | Protocol fee in basis points; must be `0`-`10000` or the process fails to start |
| `API_KEY` | – | If set, mutating requests must send `x-api-key` |
| `CORS_ORIGIN` | – | Comma-separated allowlist of origins; unset allows any origin |
| `BODY_LIMIT` | `100kb` | Maximum accepted JSON request body size (`express.json` `limit` syntax) |
| `MAINTENANCE_MODE` | `false` | When `1`/`true`, mutating requests are rejected with `503` |
| `NODE_ENV` | `development` | Environment name |

### Architecture

```
routes/        HTTP layer (thin controllers)
services/      business rules (liquidity, quotes, anchors, settlements)
repositories/  in-memory stores (swappable for an indexer)
middleware/    request id, logging, API-key auth, rate limiting, error handling
models/        domain types
config.ts      env-based configuration
```

## Contributing

1. Fork the repo and create a branch from `main`.
2. Install deps: `npm install`. Run tests: `npm test`; lint: `npm run lint`.
3. Open a pull request. CI runs lint, build, and tests on push/PR to `main`.

## License

MIT
