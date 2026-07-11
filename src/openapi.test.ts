import request from "supertest";
import { createApp } from "./app";
import { buildOpenApiSpec } from "./openapi";

describe("openapi spec", () => {
  it("describes the anchors, settlements, liquidity, quote and metrics routes", () => {
    const spec = buildOpenApiSpec() as { paths: Record<string, unknown> };

    expect(spec.paths).toHaveProperty("/api/v1/anchors");
    expect(spec.paths).toHaveProperty("/api/v1/anchors/{id}/reactivate");
    expect(spec.paths).toHaveProperty("/api/v1/settlements");
    expect(spec.paths).toHaveProperty("/api/v1/liquidity");
    expect(spec.paths).toHaveProperty("/api/v1/liquidity/withdraw");
    expect(spec.paths).toHaveProperty("/api/v1/quote");
    expect(spec.paths).toHaveProperty("/api/v1/metrics");
    expect(spec.paths).toHaveProperty("/api/v1/metrics/history");
  });

  it("serves the spec over GET /api/v1/openapi.json", async () => {
    const res = await request(createApp()).get("/api/v1/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.paths["/api/v1/settlements"].get).toBeDefined();
    expect(
      res.body.paths["/api/v1/settlements"].get.parameters,
    ).toEqual(expect.arrayContaining(["sort", "order", "asset", "anchor"]));
  });
});
