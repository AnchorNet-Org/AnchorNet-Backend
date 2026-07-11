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
- `GET /api/v1/info` – API name and version
- `GET /api/v1/openapi.json` – hand-maintained OpenAPI-shaped description of
  every route below

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

### Routing

- `POST /api/v1/quote` – compute a routing quote `{ asset, amount }`. Selects
  anchor liquidity largest-first and applies the protocol fee, returning
  `{ asset, amount, fee, deliverable, route }`. Returns `400`
  (`INSUFFICIENT_LIQUIDITY`) when the pool cannot cover the amount.

### Anchors

- `POST /api/v1/anchors` – register an anchor `{ id, name? }` (`409` if it exists)
- `GET /api/v1/anchors` – list anchors; supports `?status=active` or
  `?status=inactive` (`400` for any other value), and `?sort=id|name|registeredAt`
  with `?order=asc|desc` (default `asc`)
- `GET /api/v1/anchors/:id` – read one anchor (`404` if unknown)
- `DELETE /api/v1/anchors/:id` – deactivate an anchor
- `POST /api/v1/anchors/:id/reactivate` – reactivate a previously deactivated
  anchor (`404` if unknown)

### Settlements

- `POST /api/v1/settlements` – open a settlement `{ anchor, asset, amount }`,
  reserving liquidity. Returns `201` with the pending settlement.
- `GET /api/v1/settlements` – list settlements; supports `?anchor=`, `?asset=`,
  `?sort=id|amount|fee|status|createdAt` with `?order=asc|desc` (default
  `asc`), `?page=`, `?pageSize=`
- `GET /api/v1/settlements/:id` – read one settlement
- `POST /api/v1/settlements/:id/execute` – execute a pending settlement
- `POST /api/v1/settlements/:id/cancel` – cancel and release reserved liquidity

### Metrics

- `GET /api/v1/metrics` – aggregate counts (anchors, pools, liquidity, settlements)

Errors use a uniform envelope: `{ "error": { "code", "message" } }`, including
malformed JSON (`400`) and oversized request bodies (`413`,
`PAYLOAD_TOO_LARGE`). Every response carries an `x-request-id` header for
tracing, plus a small set of defensive security headers (`X-Content-Type-Options`,
`X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `X-DNS-Prefetch-Control`).

Mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) are rate-limited per client
IP (default 30 requests/minute, in-memory). Requests over the limit receive
`429` with code `RATE_LIMITED`.

The process shuts down gracefully on `SIGTERM`/`SIGINT`: it stops accepting
new connections, closes the HTTP server, and force-exits if it hasn't closed
within 10 seconds.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `FEE_BPS` | `10` | Protocol fee in basis points; must be `0`-`10000` or the process fails to start |
| `API_KEY` | – | If set, mutating requests must send `x-api-key` |
| `CORS_ORIGIN` | – | Comma-separated allowlist of origins; unset allows any origin |
| `BODY_LIMIT` | `100kb` | Maximum accepted JSON request body size (`express.json` `limit` syntax) |
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
