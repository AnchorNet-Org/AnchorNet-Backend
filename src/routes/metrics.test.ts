import request from "supertest";
import { createApp } from "../app";
import { Express } from "express";

async function seed(app: Express): Promise<void> {
  await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
  await request(app)
    .post("/api/v1/liquidity")
    .send({ anchor: "anchorA", asset: "USDC", amount: 1000 });
  await request(app)
    .post("/api/v1/settlements")
    .send({ anchor: "anchorA", asset: "USDC", amount: 200 });
}

describe("metrics route", () => {
  it("reports zeroed metrics on a fresh app", async () => {
    const res = await request(createApp()).get("/api/v1/metrics");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      anchors: 0,
      pools: 0,
      totalLiquidity: 0,
      settlements: 0,
    });
  });

  it("aggregates anchors, pools and settlements", async () => {
    const app = createApp();
    await seed(app);

    const res = await request(app).get("/api/v1/metrics");
    expect(res.body.anchors).toBe(1);
    expect(res.body.activeAnchors).toBe(1);
    expect(res.body.pools).toBe(1);
    expect(res.body.totalLiquidity).toBe(1000);
    expect(res.body.settlements).toBe(1);
    expect(res.body.pendingSettlements).toBe(1);
  });
});
