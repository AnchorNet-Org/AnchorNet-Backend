import express, { Express } from "express";
import request from "supertest";
import { createAuditLog } from "./auditLog";

function makeApp(audit: ReturnType<typeof createAuditLog>): Express {
  const app = express();
  app.use(audit.middleware);
  app.post("/mutate", (_req, res) => res.status(201).json({ ok: true }));
  app.get("/read", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("createAuditLog", () => {
  it("records a mutating request once its response finishes", async () => {
    const audit = createAuditLog();
    const app = makeApp(audit);

    await request(app).post("/mutate");

    expect(audit.entries()).toHaveLength(1);
    expect(audit.entries()[0]).toMatchObject({
      method: "POST",
      path: "/mutate",
      status: 201,
    });
  });

  it("does not record read-only requests", async () => {
    const audit = createAuditLog();
    const app = makeApp(audit);

    await request(app).get("/read");

    expect(audit.entries()).toHaveLength(0);
  });

  it("evicts the oldest entry once over the configured limit", async () => {
    const audit = createAuditLog(2);
    const app = makeApp(audit);

    await request(app).post("/mutate");
    await request(app).post("/mutate");
    await request(app).post("/mutate");

    expect(audit.entries()).toHaveLength(2);
  });
});
