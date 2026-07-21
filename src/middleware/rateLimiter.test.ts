import express, { Express, Request, Response } from "express";
import request from "supertest";
import { rateLimiter, RateLimitOptions } from "./rateLimiter";
import { errorHandler } from "./errorHandler";

function makeApp(options?: RateLimitOptions, configuredApiKey?: string): Express {
  const app = express();
  app.set("trust proxy", true);
  app.use(rateLimiter(options, configuredApiKey));
  app.post("/mutate", (_req, res) => res.status(201).json({ ok: true }));
  app.get("/read", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("rateLimiter", () => {
  it("allows requests under the limit", async () => {
    const app = makeApp({ max: 2, windowMs: 1000 });

    const first = await request(app).post("/mutate");
    const second = await request(app).post("/mutate");

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("rejects requests over the limit with 429", async () => {
    const app = makeApp({ max: 2, windowMs: 1000 });
    await request(app).post("/mutate");
    await request(app).post("/mutate");

    const third = await request(app).post("/mutate");

    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("RATE_LIMITED");
  });

  it("does not rate-limit read-only requests", async () => {
    const app = makeApp({ max: 1, windowMs: 1000 });
    await request(app).get("/read");

    const res = await request(app).get("/read");

    expect(res.status).toBe(200);
  });

  it("resets the count once the window elapses", async () => {
    const app = makeApp({ max: 1, windowMs: 20 });
    await request(app).post("/mutate");

    await new Promise((resolve) => setTimeout(resolve, 40));
    const res = await request(app).post("/mutate");

    expect(res.status).toBe(201);
  });

  it("keeps separate buckets for different API keys sharing an IP", async () => {
    const app = makeApp({ max: 1, windowMs: 1000 }, "configured-key");

    const first = await request(app)
      .post("/mutate")
      .set("x-api-key", "integration-a")
      .set("x-forwarded-for", "192.0.2.1");
    const second = await request(app)
      .post("/mutate")
      .set("x-api-key", "integration-b")
      .set("x-forwarded-for", "192.0.2.1");

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("shares a bucket for the same API key across different IPs", async () => {
    const app = makeApp({ max: 1, windowMs: 1000 }, "configured-key");

    const first = await request(app)
      .post("/mutate")
      .set("x-api-key", "integration-a")
      .set("x-forwarded-for", "192.0.2.1");
    const second = await request(app)
      .post("/mutate")
      .set("x-api-key", "integration-a")
      .set("x-forwarded-for", "198.51.100.1");

    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
  });

  it("continues bucketing by IP when no API key is configured", async () => {
    const app = makeApp({ max: 1, windowMs: 1000 });

    const first = await request(app)
      .post("/mutate")
      .set("x-api-key", "integration-a")
      .set("x-forwarded-for", "192.0.2.1");
    const second = await request(app)
      .post("/mutate")
      .set("x-api-key", "integration-b")
      .set("x-forwarded-for", "192.0.2.1");

    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
  });

  it("uses a fallback bucket when no client IP is available", () => {
    const limiter = rateLimiter();
    const req = { method: "POST", ip: undefined } as unknown as Request;
    const next = jest.fn();

    for (let count = 0; count <= 30; count += 1) {
      limiter(req, {} as Response, next);
    }

    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 429, code: "RATE_LIMITED" }),
    );
  });
});
