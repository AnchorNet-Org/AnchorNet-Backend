import request from "supertest";
import { createApp } from "./app";
import { markNotReady } from "./utils/readiness";

describe("liveness and readiness endpoints", () => {
  it("GET /health/live always returns 200", async () => {
    const res = await request(createApp()).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /health/ready returns 200 while ready", async () => {
    const res = await request(createApp()).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready" });
  });

  it("GET /health/ready returns 503 once marked not ready", async () => {
    markNotReady();

    const res = await request(createApp()).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "not_ready" });
  });
});
