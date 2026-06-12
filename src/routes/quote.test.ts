import request from "supertest";
import { createApp } from "../app";
import { Express } from "express";

async function seedPool(app: Express): Promise<void> {
  await request(app)
    .post("/api/v1/liquidity")
    .send({ anchor: "big", asset: "USDC", amount: 1000 });
  await request(app)
    .post("/api/v1/liquidity")
    .send({ anchor: "mid", asset: "USDC", amount: 400 });
}

describe("quote routes", () => {
  it("returns a routing quote with fee and deliverable", async () => {
    const app = createApp();
    await seedPool(app);

    const res = await request(app)
      .post("/api/v1/quote")
      .send({ asset: "USDC", amount: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.route).toEqual(["big"]);
    expect(res.body.fee).toBe(1);
    expect(res.body.deliverable).toBe(999);
  });

  it("returns 400 when liquidity is insufficient", async () => {
    const app = createApp();
    await seedPool(app);

    const res = await request(app)
      .post("/api/v1/quote")
      .send({ asset: "USDC", amount: 9999 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INSUFFICIENT_LIQUIDITY");
  });
});
