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

  it("starts with no metrics history", async () => {
    const res = await request(createApp()).get("/api/v1/metrics/history");
    expect(res.status).toBe(200);
    expect(res.body.snapshots).toEqual([]);
  });

  it("records a snapshot on every read of the current metrics", async () => {
    const app = createApp();
    await seed(app);

    await request(app).get("/api/v1/metrics");
    await request(app).get("/api/v1/metrics");

    const res = await request(app).get("/api/v1/metrics/history");
    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(2);
    expect(res.body.snapshots[0]).toMatchObject({
      anchors: 1,
      settlements: 1,
    });
    expect(typeof res.body.snapshots[0].timestamp).toBe("string");
  });

  it("records snapshots on a fixed interval when configured", async () => {
    jest.useFakeTimers();
    try {
      const originalEnv = process.env.METRICS_SNAPSHOT_INTERVAL_MS;
      process.env.METRICS_SNAPSHOT_INTERVAL_MS = "1000";
      
      const app = createApp();
      await seed(app);

      // Verify no history initially
      let res = await request(app).get("/api/v1/metrics/history");
      expect(res.body.snapshots).toHaveLength(0);

      // Advance time by 3 seconds (should trigger 3 snapshots)
      jest.advanceTimersByTime(3000);

      // Verify history has been populated
      res = await request(app).get("/api/v1/metrics/history");
      expect(res.body.snapshots).toHaveLength(3);
      expect(res.body.snapshots[0].anchors).toBe(1);

      // Restore env
      if (originalEnv === undefined) {
        delete process.env.METRICS_SNAPSHOT_INTERVAL_MS;
      } else {
        process.env.METRICS_SNAPSHOT_INTERVAL_MS = originalEnv;
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
