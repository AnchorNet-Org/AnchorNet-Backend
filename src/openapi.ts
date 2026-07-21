/**
 * Static, hand-maintained OpenAPI-shaped description of the AnchorNet API
 * surface, served at `GET /api/v1/openapi.json`.
 *
 * This is not generated from the routers, so it must be kept in sync as
 * endpoints are added or changed. It intentionally favors a short, readable
 * summary per operation over a fully-typed OpenAPI document with schemas.
 */

const PKG_VERSION = "0.9.0";

export function buildOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: {
      title: "AnchorNet API",
      version: PKG_VERSION,
      description: "Liquidity coordination network for Stellar anchors",
    },
    paths: {
      "/health": {
        get: { summary: "Health check" },
      },
      "/health/live": {
        get: { summary: "Liveness probe (always 200 while the process is up)" },
      },
      "/health/ready": {
        get: {
          summary:
            "Readiness probe (503 once graceful shutdown has begun)",
        },
      },
      "/api/v1/info": {
        get: { summary: "API name and version" },
      },
      "/api/v1/audit": {
        get: {
          summary:
            "Recent mutating requests (method, path, status, request id, timestamp)",
        },
      },
      "/api/v1/liquidity": {
        post: {
          summary:
            "Record (or accumulate) liquidity for an anchor/asset pair",
        },
        get: { summary: "List aggregated liquidity pools" },
      },
      "/api/v1/liquidity/withdraw": {
        post: { summary: "Withdraw previously recorded liquidity" },
      },
      "/api/v1/liquidity/entries": {
        get: { summary: "List raw per-anchor liquidity entries" },
      },
      "/api/v1/liquidity/{asset}": {
        get: { summary: "Read the aggregated pool for one asset" },
      },
      "/api/v1/liquidity/{anchor}/{asset}": {
        delete: {
          summary: "Remove an anchor's entire liquidity entry for an asset",
          description:
            "Administrative operation that bypasses reserved-liquidity accounting checks. " +
            "Confirm that no pending settlements depend on the entry before removing it.",
        },
      },
      "/api/v1/quote": {
        post: {
          summary:
            "Compute a largest-first routing quote. When one anchor cannot cover the full amount, " +
            "additional anchors are added until the amount is covered. Each route entry includes the " +
            "anchor and the portion it supplies.",
        },
      },
      "/api/v1/anchors": {
        post: { summary: "Register an anchor" },
        get: {
          summary: "List anchors",
          parameters: ["status", "q", "sort", "order", "format"],
        },
      },
      "/api/v1/anchors/{id}": {
        get: { summary: "Read one anchor" },
        patch: { summary: "Partially update an anchor's name" },
        delete: { summary: "Deactivate an anchor" },
      },
      "/api/v1/anchors/{id}/reactivate": {
        post: { summary: "Reactivate a previously deactivated anchor" },
      },
      "/api/v1/anchors/bulk": {
        post: { summary: "Register a batch of anchors atomically" },
      },
      "/api/v1/anchors/{id}/settlements": {
        get: {
          summary: "List settlements scoped to a specific anchor",
          description:
            "Returns the same paginated settlement list as GET /api/v1/settlements?anchor={id}, " +
            "but scoped to the anchor identified by :id. Returns 404 if the anchor does not exist.",
          parameters: ["sort", "order", "page", "pageSize", "format"],
        },
      },
      "/api/v1/settlements": {
        post: { summary: "Open a settlement, reserving liquidity" },
        get: {
          summary: "List settlements",
          parameters: [
            "anchor",
            "asset",
            "sort",
            "order",
            "page",
            "pageSize",
            "format",
          ],
        },
      },
      "/api/v1/settlements/{id}": {
        get: { summary: "Read one settlement" },
      },
      "/api/v1/settlements/{id}/execute": {
        post: { summary: "Execute a pending settlement" },
      },
      "/api/v1/settlements/{id}/cancel": {
        post: {
          summary: "Cancel a pending settlement and release its liquidity",
        },
      },
      "/api/v1/metrics": {
        get: { summary: "Aggregate network metrics" },
      },
      "/api/v1/metrics/history": {
        get: { summary: "Recent aggregate metrics snapshots, oldest first" },
      },
    },
  };
}
