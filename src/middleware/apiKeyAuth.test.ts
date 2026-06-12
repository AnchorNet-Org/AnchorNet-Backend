import request from "supertest";
import { createApp } from "../app";

describe("apiKeyAuth", () => {
  const original = process.env.API_KEY;

  beforeEach(() => {
    process.env.API_KEY = "secret";
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = original;
    }
  });

  it("allows read-only requests without a key", async () => {
    const res = await request(createApp()).get("/api/v1/liquidity");
    expect(res.status).toBe(200);
  });

  it("rejects mutations without a valid key", async () => {
    const res = await request(createApp())
      .post("/api/v1/anchors")
      .send({ id: "anchorA" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows mutations with the correct key", async () => {
    const res = await request(createApp())
      .post("/api/v1/anchors")
      .set("x-api-key", "secret")
      .send({ id: "anchorA" });

    expect(res.status).toBe(201);
  });
});
