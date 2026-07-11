import express, { Express } from "express";
import request from "supertest";
import { securityHeaders } from "./securityHeaders";

function makeApp(): Express {
  const app = express();
  app.use(securityHeaders);
  app.get("/read", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("securityHeaders", () => {
  it("sets the defensive header set on every response", async () => {
    const res = await request(makeApp()).get("/read");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-xss-protection"]).toBe("0");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["x-dns-prefetch-control"]).toBe("off");
  });
});
