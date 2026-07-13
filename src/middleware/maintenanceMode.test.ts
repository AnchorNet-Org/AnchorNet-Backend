import express, { Express } from "express";
import request from "supertest";
import { maintenanceMode } from "./maintenanceMode";
import { errorHandler } from "./errorHandler";

function makeApp(enabled: boolean): Express {
  const app = express();
  app.use(maintenanceMode(enabled));
  app.post("/mutate", (_req, res) => res.status(201).json({ ok: true }));
  app.get("/read", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("maintenanceMode", () => {
  it("rejects mutating requests with 503 when enabled", async () => {
    const res = await request(makeApp(true)).post("/mutate");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("still allows read-only requests when enabled", async () => {
    const res = await request(makeApp(true)).get("/read");

    expect(res.status).toBe(200);
  });

  it("allows mutating requests through when disabled", async () => {
    const res = await request(makeApp(false)).post("/mutate");

    expect(res.status).toBe(201);
  });
});
