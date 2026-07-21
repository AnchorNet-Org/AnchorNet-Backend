import request from "supertest";
import { createApp } from "../app";

describe("liquidity routes", () => {
  it("creates liquidity and returns the stored entry", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "usdc", amount: 500 });

    expect(res.status).toBe(201);
    expect(res.body.asset).toBe("USDC");
    expect(res.body.amount).toBe(500);
  });

  it("lists aggregated pools", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: 500 });
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorB", asset: "USDC", amount: 300 });

    const res = await request(app).get("/api/v1/liquidity");
    expect(res.status).toBe(200);
    expect(res.body.pools).toEqual([
      { asset: "USDC", total: 800, anchors: 2 },
    ]);
  });

  it("reads a single pool by asset", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: 500 });

    const res = await request(app).get("/api/v1/liquidity/usdc");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(500);
  });

  it("returns 400 for an invalid amount", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 for an unknown pool", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/liquidity/XLM");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("withdraws liquidity and returns the reduced entry", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: 500 });

    const res = await request(app)
      .post("/api/v1/liquidity/withdraw")
      .send({ anchor: "anchorA", asset: "USDC", amount: 200 });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(300);

    const pool = await request(app).get("/api/v1/liquidity/USDC");
    expect(pool.body.total).toBe(300);
  });

  it("removes the pool once the full balance is withdrawn", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: 500 });

    const res = await request(app)
      .post("/api/v1/liquidity/withdraw")
      .send({ anchor: "anchorA", asset: "USDC", amount: 500 });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(0);

    const pool = await request(app).get("/api/v1/liquidity/USDC");
    expect(pool.status).toBe(404);
  });

  it("returns 400 when withdrawing more than the available balance", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const res = await request(app)
      .post("/api/v1/liquidity/withdraw")
      .send({ anchor: "anchorA", asset: "USDC", amount: 200 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INSUFFICIENT_LIQUIDITY");
  });

  it("returns 404 when withdrawing from an anchor with no balance", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/liquidity/withdraw")
      .send({ anchor: "anchorA", asset: "USDC", amount: 10 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("deletes one anchor's entire liquidity entry", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: 500 });
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorB", asset: "USDC", amount: 300 });

    const res = await request(app).delete(
      "/api/v1/liquidity/anchorA/usdc",
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      anchor: "anchorA",
      asset: "USDC",
      amount: 500,
    });

    const entries = await request(app).get("/api/v1/liquidity/entries");
    expect(entries.body.entries).toHaveLength(1);
    expect(entries.body.entries[0].anchor).toBe("anchorB");
  });

  it("returns 404 when deleting a non-existent liquidity entry", async () => {
    const res = await request(createApp()).delete(
      "/api/v1/liquidity/anchorA/USDC",
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
