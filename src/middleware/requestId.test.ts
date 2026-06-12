import request from "supertest";
import { createApp } from "../app";

describe("requestId", () => {
  it("sets an x-request-id header on responses", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).not.toEqual("");
  });

  it("echoes an inbound request id", async () => {
    const res = await request(createApp())
      .get("/health")
      .set("x-request-id", "trace-123");

    expect(res.headers["x-request-id"]).toBe("trace-123");
  });
});
