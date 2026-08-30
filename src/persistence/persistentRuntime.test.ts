import request from "supertest";
import { createApp } from "../app";
import { PersistenceRuntime } from "./runtime";
import { PostgresPersistence } from "./postgres";

describe("PostgreSQL runtime composition", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("hydrates the production repository graph and flushes durable mutations", async () => {
    process.env.DATABASE_URL = "postgres://localhost/anchornet";
    const calls: string[] = [];
    const created = {
      id: 1,
      anchor: "anchorA",
      asset: "USDC",
      amount: 100n,
      fee: 1n,
      status: "pending" as const,
      createdAt: "2026-08-30T00:00:00.000Z",
    };
    const database = {
      upsertAnchor: async () => { calls.push("anchor"); },
      removeAnchor: async () => undefined,
      upsertLiquidity: async () => { calls.push("liquidity"); },
      removeLiquidity: async () => undefined,
      insertSettlement: async () => undefined,
      removeSettlement: async () => undefined,
      flush: async () => { calls.push("flush"); },
      openSettlement: async () => created,
      transitionSettlement: async () => ({ ...created, status: "executed" as const }),
    } as unknown as PostgresPersistence;
    const runtime: PersistenceRuntime = {
      database,
      snapshot: {
        anchors: [],
        liquidity: [],
        settlements: [],
      },
    };
    const app = createApp({ persistence: runtime });

    const anchorResponse = await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA" });
    expect(anchorResponse.status).toBe(201);

    const liquidityResponse = await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: "100" });
    expect(liquidityResponse.status).toBe(201);

    const settlementResponse = await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: "100" });
    expect(settlementResponse.status).toBe(201);
    expect(settlementResponse.body).toMatchObject({ id: 1, status: "pending" });
    expect(calls).toEqual(expect.arrayContaining(["anchor", "liquidity", "flush"]));
  });
});
