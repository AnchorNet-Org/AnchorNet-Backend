# Changelog

All notable changes to the AnchorNet API are documented here.

## [0.5.0]

### Added

- **Service:** `GET /api/v1/openapi.json`, a hand-maintained OpenAPI-shaped
  description of every route.
- **Middleware:** hand-rolled security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`,
  `X-DNS-Prefetch-Control`) applied to every response.
- **Configuration:** `CORS_ORIGIN` to restrict cross-origin requests to a
  comma-separated allowlist (unset keeps the previous permissive default);
  `BODY_LIMIT` to cap accepted JSON request body size (default `100kb`).
- **Process:** graceful shutdown on `SIGTERM`/`SIGINT` — stops accepting new
  connections, closes the HTTP server, and force-exits after a 10s timeout.

### Changed

- **Configuration:** `FEE_BPS` is now validated at startup; the process fails
  fast if it falls outside `0`-`10000`.

### Fixed

- **Errors:** malformed JSON and oversized request bodies now return the
  standard error envelope (`400`/`413`) instead of a generic `500`.

## [0.4.0]

### Added

- **Anchors:** `POST /api/v1/anchors/:id/reactivate` to reverse a
  deactivation without re-registering the anchor.
- **Settlements:** `?asset=` filter on `GET /api/v1/settlements`, composable
  with the existing `?anchor=` filter.
- **Sorting:** `?sort=`/`?order=` on `GET /api/v1/anchors` (`id`, `name`,
  `registeredAt`) and `GET /api/v1/settlements` (`id`, `amount`, `fee`,
  `status`, `createdAt`), backed by a new generic `applySort` utility.

## [0.3.0]

### Added

- **Liquidity:** `POST /api/v1/liquidity/withdraw` to withdraw previously
  recorded liquidity, mirroring the on-chain contract's `withdraw_liquidity`.
  Reduces an anchor's balance and removes the entry once it reaches zero.
- **Anchors:** `?status=active` / `?status=inactive` filter on
  `GET /api/v1/anchors`.
- **Middleware:** in-memory rate limiting for mutating requests (default 30
  requests/minute per client IP), returning `429` (`RATE_LIMITED`) when
  exceeded.
- **Errors:** a `tooManyRequests` (429) helper on `ApiError`.

## [0.2.0]

### Added

- **Anchors:** registry endpoints (`/api/v1/anchors`) with register, list, read
  and deactivate, backed by an anchor service and repository.
- **Settlements:** `/api/v1/settlements` to open, execute, cancel, list (with
  `?anchor=` filter and pagination) and read settlements. Liquidity is reserved
  on open, released on cancel, and consumed on execute.
- **Metrics:** `/api/v1/metrics` aggregate view of anchors, pools, liquidity and
  settlements.
- **Configuration:** env-based `loadConfig` (`PORT`, `FEE_BPS`, `API_KEY`,
  `NODE_ENV`).
- **Middleware:** request-id tracing and optional API-key auth for mutating
  requests.
- **Utilities:** offset-based pagination helper.

### Changed

- Extracted the Express app into a factory and switched lint to the
  TypeScript-aware `no-unused-vars` rule.

## [0.1.0]

### Added

- Initial Express API: health/info endpoints, liquidity recording and pool
  aggregation, and a largest-first routing quote endpoint.
