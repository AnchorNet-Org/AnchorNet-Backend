import request from "supertest";
import { createApp } from "./app";

describe("response compression", () => {
  it("gzips a large response when the client accepts it", async () => {
    const app = createApp();

    for (let i = 0; i < 25; i++) {
      await request(app)
        .post("/api/v1/anchors")
        .send({ id: `anchor-${i}`, name: `Anchor ${i}` });
    }

    const res = await request(app)
      .get("/api/v1/anchors")
      .set("Accept-Encoding", "gzip");

    expect(res.headers["content-encoding"]).toBe("gzip");
  });

  it("does not compress a response the client did not ask to accept", async () => {
    const res = await request(createApp())
      .get("/health")
      .set("Accept-Encoding", "identity");

    expect(res.headers["content-encoding"]).toBeUndefined();
  });
});
