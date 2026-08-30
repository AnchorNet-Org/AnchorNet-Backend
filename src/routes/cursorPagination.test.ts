import request from "supertest";
import { createApp } from "../app";

async function addAnchor(app: ReturnType<typeof createApp>, id: string): Promise<void> {
  const response = await request(app).post("/api/v1/anchors").send({ id, name: id });
  expect(response.status).toBe(201);
}

async function addLiquidity(
  app: ReturnType<typeof createApp>,
  anchor: string,
  asset: string,
  amount = "1000",
): Promise<void> {
  const response = await request(app)
    .post("/api/v1/liquidity")
    .send({ anchor, asset, amount });
  expect(response.status).toBe(201);
}

async function addSettlement(
  app: ReturnType<typeof createApp>,
  anchor: string,
  asset = "USDC",
): Promise<number> {
  const response = await request(app)
    .post("/api/v1/settlements")
    .send({ anchor, asset, amount: "1" });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

describe("cursor pagination route contract", () => {
  it("walks every anchor exactly once in canonical order", async () => {
    const app = createApp();
    for (const id of ["anchor-e", "anchor-a", "anchor-d", "anchor-b", "anchor-c"]) {
      await addAnchor(app, id);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const query = request(app).get("/api/v1/anchors").query({ pageSize: 2 });
      if (cursor) query.query({ cursor });
      const response = await query;
      expect(response.status).toBe(200);
      seen.push(...response.body.anchors.map((anchor: { id: string }) => anchor.id));
      cursor = response.body.pagination.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toEqual(["anchor-a", "anchor-b", "anchor-c", "anchor-d", "anchor-e"]);
    expect(new Set(seen).size).toBe(5);
  });

  it("keeps an anchor cursor scoped to its filters", async () => {
    const app = createApp();
    await addAnchor(app, "active-anchor");
    await addAnchor(app, "active-anchor-two");
    await addAnchor(app, "inactive-anchor");
    await request(app).delete("/api/v1/anchors/inactive-anchor");

    const first = await request(app)
      .get("/api/v1/anchors")
      .query({ status: "active", pageSize: 1 });
    expect(first.status).toBe(200);
    expect(first.body.pagination.nextCursor).toEqual(expect.any(String));

    const wrongScope = await request(app)
      .get("/api/v1/anchors")
      .query({ status: "inactive", cursor: first.body.pagination.nextCursor });
    expect(wrongScope.status).toBe(400);
    expect(wrongScope.body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects custom sorting when a cursor is supplied", async () => {
    const app = createApp();
    await addAnchor(app, "anchor-a");
    const response = await request(app)
      .get("/api/v1/anchors")
      .query({ cursor: "bad", sort: "name" });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/canonical anchor order/);
  });

  it("walks settlements in descending id order", async () => {
    const app = createApp();
    await addAnchor(app, "settlement-anchor");
    await addLiquidity(app, "settlement-anchor", "USDC", "10");
    await addSettlement(app, "settlement-anchor");
    await addSettlement(app, "settlement-anchor");
    await addSettlement(app, "settlement-anchor");

    const first = await request(app)
      .get("/api/v1/settlements")
      .query({ pageSize: 2 });
    expect(first.body.settlements.map((settlement: { id: number }) => settlement.id)).toEqual([3, 2]);

    const second = await request(app)
      .get("/api/v1/settlements")
      .query({ pageSize: 2, cursor: first.body.pagination.nextCursor });
    expect(second.status).toBe(200);
    expect(second.body.settlements.map((settlement: { id: number }) => settlement.id)).toEqual([1]);
    expect(second.body.pagination.nextCursor).toBeNull();
  });

  it("does not move a newly inserted settlement into an existing traversal", async () => {
    const app = createApp();
    await addAnchor(app, "snapshot-anchor");
    await addLiquidity(app, "snapshot-anchor", "USDC", "10");
    await addSettlement(app, "snapshot-anchor");
    await addSettlement(app, "snapshot-anchor");
    await addSettlement(app, "snapshot-anchor");

    const first = await request(app)
      .get("/api/v1/settlements")
      .query({ pageSize: 1 });
    await addSettlement(app, "snapshot-anchor");

    const second = await request(app)
      .get("/api/v1/settlements")
      .query({ pageSize: 10, cursor: first.body.pagination.nextCursor });
    expect(second.body.settlements.map((settlement: { id: number }) => settlement.id)).toEqual([2, 1]);
  });

  it("rejects a cursor from one settlement filter on another", async () => {
    const app = createApp();
    await addAnchor(app, "filter-anchor");
    await addLiquidity(app, "filter-anchor", "USDC", "10");
    await addSettlement(app, "filter-anchor");
    await addSettlement(app, "filter-anchor");

    const first = await request(app)
      .get("/api/v1/settlements")
      .query({ anchor: "filter-anchor", pageSize: 1 });
    const wrongScope = await request(app)
      .get("/api/v1/settlements")
      .query({ asset: "USDC", cursor: first.body.pagination.nextCursor });
    expect(wrongScope.status).toBe(400);
  });

  it("adds cursor pagination to every liquidity collection envelope", async () => {
    const app = createApp();
    await addLiquidity(app, "liquidity-a", "USDC", "10");
    await addLiquidity(app, "liquidity-b", "EURC", "20");
    await request(app)
      .post("/api/v1/liquidity/withdraw")
      .send({ anchor: "liquidity-a", asset: "USDC", amount: "1" });

    const endpoints = [
      ["/api/v1/liquidity", "pools"],
      ["/api/v1/liquidity/entries", "entries"],
      ["/api/v1/liquidity/withdrawals", "withdrawals"],
      ["/api/v1/liquidity/anchors/liquidity-a", "entries"],
    ] as const;

    for (const [endpoint, collection] of endpoints) {
      const response = await request(app).get(endpoint).query({ pageSize: 1 });
      expect(response.status).toBe(200);
      expect(response.body[collection]).toHaveLength(1);
      expect(response.body.pagination.pageSize).toBe(1);
      expect(response.body.pagination.nextCursor === null || typeof response.body.pagination.nextCursor === "string").toBe(true);
    }
  });

  it("rejects malformed cursors without exposing cursor internals", async () => {
    const app = createApp();
    const response = await request(app)
      .get("/api/v1/liquidity")
      .query({ cursor: "not-a-cursor" });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("cursor is malformed or expired");
    expect(response.body.error.message).not.toMatch(/snapshot|after|base64/);
  });

  it("clamps route page sizes to one hundred", async () => {
    const app = createApp();
    const response = await request(app)
      .get("/api/v1/anchors")
      .query({ pageSize: 999999 });
    expect(response.status).toBe(200);
    expect(response.body.pagination.pageSize).toBe(100);
  });
});
