import request from "supertest";
import app from "./index";

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
});
