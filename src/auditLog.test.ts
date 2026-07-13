import request from "supertest";
import { createApp } from "./app";

describe("audit log endpoint", () => {
  it("records mutating requests and exposes them via GET /api/v1/audit", async () => {
    const app = createApp();

    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).get("/api/v1/anchors");

    const res = await request(app).get("/api/v1/audit");

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0]).toMatchObject({
      method: "POST",
      path: "/api/v1/anchors",
      status: 201,
    });
  });
});
