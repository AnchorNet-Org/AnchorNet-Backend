/**
 * App-level tests for the `cors` middleware's preflight handling.
 *
 * `app.ts` mounts `cors(config.corsOrigins ? { origin: config.corsOrigins } : undefined)`,
 * and `config.test.ts` only covers the env parsing. These tests exercise actual
 * `OPTIONS` preflight requests against a mutating route (`POST /api/v1/anchors`)
 * to confirm the configured allowlist is honored at the HTTP layer: allowed
 * origins are reflected, disallowed origins are not, and — with `CORS_ORIGIN`
 * unset — the documented unrestricted default still holds.
 */
import request from "supertest";
import { createApp } from "./app";

describe("CORS preflight (OPTIONS) against a mutating route", () => {
  const original = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = original;
    }
  });

  it("reflects an allowlisted origin in the preflight response", async () => {
    process.env.CORS_ORIGIN = "https://allowed.example";

    const res = await request(createApp())
      .options("/api/v1/anchors")
      .set("Origin", "https://allowed.example")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://allowed.example",
    );
    // The preflight must permit the mutating method the browser asked about.
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("does not reflect a non-allowlisted origin in the preflight response", async () => {
    process.env.CORS_ORIGIN = "https://allowed.example";

    const res = await request(createApp())
      .options("/api/v1/anchors")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.example",
    );
  });

  it("permits any origin when CORS_ORIGIN is unset (documented default)", async () => {
    delete process.env.CORS_ORIGIN;

    const res = await request(createApp())
      .options("/api/v1/anchors")
      .set("Origin", "https://anything.example")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
