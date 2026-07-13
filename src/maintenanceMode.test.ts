import request from "supertest";
import { createApp } from "./app";

describe("maintenance mode enforcement", () => {
  const original = process.env.MAINTENANCE_MODE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MAINTENANCE_MODE;
    } else {
      process.env.MAINTENANCE_MODE = original;
    }
  });

  it("rejects a mutating request with 503 when enabled", async () => {
    process.env.MAINTENANCE_MODE = "true";

    const res = await request(createApp())
      .post("/api/v1/anchors")
      .send({ id: "anchor-1" });

    expect(res.status).toBe(503);
  });

  it("still serves reads when enabled", async () => {
    process.env.MAINTENANCE_MODE = "true";

    const res = await request(createApp()).get("/api/v1/anchors");

    expect(res.status).toBe(200);
  });

  it("allows mutating requests when unset", async () => {
    delete process.env.MAINTENANCE_MODE;

    const res = await request(createApp())
      .post("/api/v1/anchors")
      .send({ id: "anchor-2" });

    expect(res.status).toBe(201);
  });
});
