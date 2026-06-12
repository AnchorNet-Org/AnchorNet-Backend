import request from "supertest";
import { createApp } from "../app";

describe("anchor routes", () => {
  it("registers an anchor", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA", name: "Anchor A" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("anchorA");
    expect(res.body.active).toBe(true);
  });

  it("rejects a duplicate anchor with 409", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    const res = await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("lists and reads anchors", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(1);

    const one = await request(app).get("/api/v1/anchors/anchorA");
    expect(one.status).toBe(200);
    expect(one.body.id).toBe("anchorA");
  });

  it("deactivates an anchor", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app).delete("/api/v1/anchors/anchorA");
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it("returns 404 for an unknown anchor", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/anchors/missing");
    expect(res.status).toBe(404);
  });
});
