import request from "supertest";
import { createApp } from "./app";

describe("configurable JSON body size limit", () => {
  const original = process.env.BODY_LIMIT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BODY_LIMIT;
    } else {
      process.env.BODY_LIMIT = original;
    }
  });

  it("rejects a request body larger than the configured limit", async () => {
    process.env.BODY_LIMIT = "10b";

    const res = await request(createApp())
      .post("/api/v1/anchors")
      .send({ id: "a".repeat(50) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("accepts a request body within the configured limit", async () => {
    process.env.BODY_LIMIT = "1mb";

    const res = await request(createApp())
      .post("/api/v1/anchors")
      .send({ id: "anchorA" });

    expect(res.status).toBe(201);
  });
});
