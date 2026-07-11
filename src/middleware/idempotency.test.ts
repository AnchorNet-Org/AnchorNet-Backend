import express, { Express } from "express";
import request from "supertest";
import { idempotency, IdempotencyOptions } from "./idempotency";
import { errorHandler } from "./errorHandler";
import { ApiError } from "../errors/ApiError";

function makeApp(options?: IdempotencyOptions): Express {
  let counter = 0;
  const app = express();
  app.use(express.json());
  app.use(idempotency(options));
  app.post("/mutate", (_req, res) => {
    counter += 1;
    res.status(201).json({ counter });
  });
  app.post("/fail", (_req, _res, next) => {
    counter += 1;
    next(ApiError.conflict("already exists"));
  });
  app.get("/read", (_req, res) => {
    counter += 1;
    res.json({ counter });
  });
  app.use(errorHandler);
  return app;
}

describe("idempotency", () => {
  it("replays the cached response for a repeated key", async () => {
    const app = makeApp();

    const first = await request(app)
      .post("/mutate")
      .set("Idempotency-Key", "abc123");
    const second = await request(app)
      .post("/mutate")
      .set("Idempotency-Key", "abc123");

    expect(first.status).toBe(201);
    expect(first.body.counter).toBe(1);
    expect(second.status).toBe(201);
    expect(second.body.counter).toBe(1); // handler did not re-run
  });

  it("runs the handler again for a different key", async () => {
    const app = makeApp();

    const first = await request(app)
      .post("/mutate")
      .set("Idempotency-Key", "key-a");
    const second = await request(app)
      .post("/mutate")
      .set("Idempotency-Key", "key-b");

    expect(first.body.counter).toBe(1);
    expect(second.body.counter).toBe(2);
  });

  it("does not cache requests without the header", async () => {
    const app = makeApp();

    const first = await request(app).post("/mutate");
    const second = await request(app).post("/mutate");

    expect(first.body.counter).toBe(1);
    expect(second.body.counter).toBe(2);
  });

  it("does not affect read-only requests", async () => {
    const app = makeApp();

    const first = await request(app)
      .get("/read")
      .set("Idempotency-Key", "same-key");
    const second = await request(app)
      .get("/read")
      .set("Idempotency-Key", "same-key");

    expect(first.body.counter).toBe(1);
    expect(second.body.counter).toBe(2);
  });

  it("replays a cached error response without re-running the handler", async () => {
    const app = makeApp();

    const first = await request(app)
      .post("/fail")
      .set("Idempotency-Key", "err-key");
    const second = await request(app)
      .post("/fail")
      .set("Idempotency-Key", "err-key");

    expect(first.status).toBe(409);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
  });

  it("re-runs the handler once the cached entry expires", async () => {
    const app = makeApp({ ttlMs: 20 });

    const first = await request(app)
      .post("/mutate")
      .set("Idempotency-Key", "expiring");
    await new Promise((resolve) => setTimeout(resolve, 40));
    const second = await request(app)
      .post("/mutate")
      .set("Idempotency-Key", "expiring");

    expect(first.body.counter).toBe(1);
    expect(second.body.counter).toBe(2);
  });
});
