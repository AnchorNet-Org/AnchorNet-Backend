# Changelog

All notable changes to the AnchorNet API are documented here.

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
