import express, { Express } from "express";
import request from "supertest";
import { rateLimiter, RateLimitOptions } from "./rateLimiter";
import { errorHandler } from "./errorHandler";

function makeApp(options?: RateLimitOptions): Express {
  const app = express();
  app.use(rateLimiter(options));
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
});
