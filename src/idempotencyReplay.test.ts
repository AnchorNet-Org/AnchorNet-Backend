import request from "supertest";
import { createApp } from "./app";

describe("idempotency-key replay through the full app", () => {
  it("replays the original response instead of rejecting a retried anchor registration", async () => {
    const app = createApp();

    const first = await request(app)
      .post("/api/v1/anchors")
      .set("Idempotency-Key", "register-anchorA")
      .send({ id: "anchorA" });
    const second = await request(app)
      .post("/api/v1/anchors")
      .set("Idempotency-Key", "register-anchorA")
      .send({ id: "anchorA" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(1);
  });

  it("still rejects a duplicate registration without an idempotency key", async () => {
    const app = createApp();

    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    const res = await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA" });

    expect(res.status).toBe(409);
  });

  it("treats different idempotency keys as independent requests", async () => {
    const app = createApp();

    const first = await request(app)
      .post("/api/v1/anchors")
      .set("Idempotency-Key", "key-1")
      .send({ id: "anchorA" });
    const second = await request(app)
      .post("/api/v1/anchors")
      .set("Idempotency-Key", "key-2")
      .send({ id: "anchorB" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(2);
  });
});
