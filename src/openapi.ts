/**
 * Static, hand-maintained OpenAPI-shaped description of the AnchorNet API
 * surface, served at `GET /api/v1/openapi.json`.
 *
 * This is not generated from the routers, so it must be kept in sync as
 * endpoints are added or changed. It intentionally favors a short, readable
 * summary per operation over a fully-typed OpenAPI document with schemas.
 */

const PKG_VERSION = "0.6.0";

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
      "/api/v1/info": {
        get: { summary: "API name and version" },
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
      "/api/v1/quote": {
        post: { summary: "Compute a largest-first routing quote" },
      },
      "/api/v1/anchors": {
        post: { summary: "Register an anchor" },
        get: {
          summary: "List anchors",
          parameters: ["status", "sort", "order"],
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
