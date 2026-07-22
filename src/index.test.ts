import request from "supertest";
import app from "./index";
import { getConfig } from "./app";

describe("AnchorNet API", () => {
  it("GET /health returns 200 and status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "anchornet-backend" });
  });

  it("GET /api/v1/info returns API info", async () => {
    const res = await request(app).get("/api/v1/info");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("AnchorNet API");
    expect(res.body.version).toBeDefined();
  });

  it("Malformed PORT env var falls back to default port", () => {
    const originalPort = process.env.PORT;
    process.env.PORT = "abc";
    // getConfig loads from process.env each call
    const config = getConfig();
    expect(config.port).toBe(3001);
    // restore env
    if (originalPort !== undefined) {
      process.env.PORT = originalPort;
    } else {
      delete process.env.PORT;
    }
  });
});
