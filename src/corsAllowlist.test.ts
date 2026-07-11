import request from "supertest";
import { createApp } from "./app";

describe("CORS allowlist enforcement", () => {
  const original = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = original;
    }
  });

  it("reflects an allowed origin in the response headers", async () => {
    process.env.CORS_ORIGIN = "https://allowed.example";

    const res = await request(createApp())
      .get("/health")
      .set("Origin", "https://allowed.example");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://allowed.example",
    );
  });

  it("omits the CORS header for a disallowed origin", async () => {
    process.env.CORS_ORIGIN = "https://allowed.example";

    const res = await request(createApp())
      .get("/health")
      .set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows any origin when no allowlist is configured", async () => {
    delete process.env.CORS_ORIGIN;

    const res = await request(createApp())
      .get("/health")
      .set("Origin", "https://anything.example");

    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
