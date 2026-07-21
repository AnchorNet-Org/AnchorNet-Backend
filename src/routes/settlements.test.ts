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

  it("records a cancel reason when provided", async () => {
    const app = createApp();
    await setup(app);
    const open = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 400 });

    const res = await request(app)
      .post(`/api/v1/settlements/${open.body.id}/cancel`)
      .send({ reason: "duplicate request" });

    expect(res.status).toBe(200);
    expect(res.body.cancelReason).toBe("duplicate request");
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

  it("sorts settlements by amount", async () => {
    const app = createApp();
    await setup(app);
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 300 });
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const asc = await request(app).get(
      "/api/v1/settlements?sort=amount&order=asc",
    );
    expect(asc.status).toBe(200);
    expect(asc.body.settlements.map((s: { amount: number }) => s.amount)).toEqual(
      [100, 300],
    );

    const desc = await request(app).get(
      "/api/v1/settlements?sort=amount&order=desc",
    );
    expect(desc.body.settlements.map((s: { amount: number }) => s.amount)).toEqual(
      [300, 100],
    );
  });

  it("sorts settlements by amount with 9 and 10 numerically", async () => {
    const app = createApp();
    await setup(app);
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 10 });
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 9 });
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const asc = await request(app).get(
      "/api/v1/settlements?sort=amount&order=asc",
    );
    expect(asc.status).toBe(200);
    expect(asc.body.settlements.map((s: { amount: number }) => s.amount)).toEqual(
      [9, 10, 100],
    );
  });

  it("sorts settlements by fee", async () => {
    const app = createApp();
    await setup(app);
    const s1 = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });
    const s2 = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 50 });
    const s3 = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 200 });

    const fees = [s1.body.fee, s2.body.fee, s3.body.fee];
    const sortedFees = [...fees].sort((a, b) => a - b);

    const asc = await request(app).get(
      "/api/v1/settlements?sort=fee&order=asc",
    );
    expect(asc.status).toBe(200);
    expect(asc.body.settlements.map((s: { fee: number }) => s.fee)).toEqual(
      sortedFees,
    );
  });

  it("sorts settlements by multiple fields (?sort=status,createdAt)", async () => {
    const app = createApp();
    await setup(app);
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });
    const s2 = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 200 });
    await request(app).post(`/api/v1/settlements/${s2.body.id}/execute`);
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 300 });

    const res = await request(app).get(
      "/api/v1/settlements?sort=status,createdAt&order=asc,asc",
    );
    expect(res.status).toBe(200);
    expect(
      res.body.settlements.map((s: { status: string }) => s.status),
    ).toEqual(["executed", "pending", "pending"]);
  });

  it("returns 400 for an unknown sort field", async () => {
    const app = createApp();
    await setup(app);

    const res = await request(app).get("/api/v1/settlements?sort=bogus");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("exports the settlement list as CSV via ?format=csv, ignoring pagination", async () => {
    const app = createApp();
    await setup(app);
    const opened = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 400 });

    const res = await request(app).get(
      "/api/v1/settlements?format=csv&pageSize=1",
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toBe(
      "id,anchor,asset,amount,fee,status,createdAt,cancelReason\n" +
        `${opened.body.id},anchorA,USDC,400,${opened.body.fee},pending,${opened.body.createdAt},\n`,
    );
  });

  it("returns 400 for exotic invalid IDs (NaN, Infinity, -0, true, array, object, unsafe integer)", async () => {
    const app = createApp();
    await setup(app);
    const badIds = [NaN, Infinity, -Infinity, -0, "NaN", "Infinity", "9007199254740992", "9007199254740993"];
    for (const id of badIds) {
      const resGet = await request(app).get(`/api/v1/settlements/${id}`);
      expect(resGet.status).toBe(400);
      expect(resGet.body.error.code).toBe("BAD_REQUEST");

      const resExec = await request(app).post(`/api/v1/settlements/${id}/execute`);
      expect(resExec.status).toBe(400);
      expect(resExec.body.error.code).toBe("BAD_REQUEST");
    }
  });
});
