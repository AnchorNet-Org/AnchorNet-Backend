import request from "supertest";
import { createApp } from "../app";
import { Express } from "express";

async function setup(app: Express): Promise<void> {
  await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
  await request(app)
    .post("/api/v1/liquidity")
    .send({ anchor: "anchorA", asset: "USDC", amount: 1000 });
}

describe("settlement routes", () => {
  it("opens a settlement reserving liquidity", async () => {
    const app = createApp();
    await setup(app);

    const res = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 400 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.id).toBe(1);
  });

  it("executes a pending settlement", async () => {
    const app = createApp();
    await setup(app);
    const open = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 400 });

    const res = await request(app).post(
      `/api/v1/settlements/${open.body.id}/execute`,
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("executed");
  });

  it("cancels a pending settlement", async () => {
    const app = createApp();
    await setup(app);
    const open = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 400 });

    const res = await request(app).post(
      `/api/v1/settlements/${open.body.id}/cancel`,
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("rejects settlement beyond available liquidity", async () => {
    const app = createApp();
    await setup(app);

    const res = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 5000 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INSUFFICIENT_LIQUIDITY");
  });

  it("filters settlements by anchor", async () => {
    const app = createApp();
    await setup(app);
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const res = await request(app).get("/api/v1/settlements?anchor=anchorA");
    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(1);
  });

  it("filters settlements by asset", async () => {
    const app = createApp();
    await setup(app);
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const matching = await request(app).get(
      "/api/v1/settlements?asset=usdc",
    );
    expect(matching.status).toBe(200);
    expect(matching.body.settlements).toHaveLength(1);

    const nonMatching = await request(app).get(
      "/api/v1/settlements?asset=EURC",
    );
    expect(nonMatching.body.settlements).toHaveLength(0);
  });
});
