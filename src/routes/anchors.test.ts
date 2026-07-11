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

  it("reactivates a deactivated anchor", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).delete("/api/v1/anchors/anchorA");

    const res = await request(app).post(
      "/api/v1/anchors/anchorA/reactivate",
    );
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
  });

  it("returns 404 reactivating an unknown anchor", async () => {
    const res = await request(createApp()).post(
      "/api/v1/anchors/missing/reactivate",
    );
    expect(res.status).toBe(404);
  });

  it("partially updates an anchor's name", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA", name: "Old Name" });

    const res = await request(app)
      .patch("/api/v1/anchors/anchorA")
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
    expect(res.body.id).toBe("anchorA");

    const one = await request(app).get("/api/v1/anchors/anchorA");
    expect(one.body.name).toBe("New Name");
  });

  it("returns 404 patching an unknown anchor", async () => {
    const res = await request(createApp())
      .patch("/api/v1/anchors/missing")
      .send({ name: "New Name" });

    expect(res.status).toBe(404);
  });

  it("returns 400 patching an anchor without a name", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app).patch("/api/v1/anchors/anchorA").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 for an unknown anchor", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/anchors/missing");
    expect(res.status).toBe(404);
  });

  it("filters the anchor list by status", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).post("/api/v1/anchors").send({ id: "anchorB" });
    await request(app).delete("/api/v1/anchors/anchorB");

    const active = await request(app).get("/api/v1/anchors?status=active");
    expect(active.status).toBe(200);
    expect(active.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "anchorA",
    ]);

    const inactive = await request(app).get(
      "/api/v1/anchors?status=inactive",
    );
    expect(inactive.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "anchorB",
    ]);
  });

  it("returns 400 for an invalid status filter", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/anchors?status=bogus");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("sorts anchors by id in descending order", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).post("/api/v1/anchors").send({ id: "anchorB" });

    const res = await request(app).get(
      "/api/v1/anchors?sort=id&order=desc",
    );
    expect(res.status).toBe(200);
    expect(res.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "anchorB",
      "anchorA",
    ]);
  });

  it("returns 400 for an unknown sort field", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/anchors?sort=bogus");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});
