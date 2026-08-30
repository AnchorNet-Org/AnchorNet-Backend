import { Pool } from "pg";
import { PostgresPersistence } from "./postgres";

jest.mock("pg", () => ({ Pool: jest.fn() }));

const poolMock = Pool as unknown as jest.Mock;

function makeDatabase(options: {
  liquidity?: string[];
  committed?: Array<{ id: number; anchor: string; asset: string; amount: string; fee: string; status: "pending" | "executed" | "cancelled"; created_at: Date; cancel_reason: string | null }>;
} = {}): { database: PostgresPersistence; queries: string[] } {
  const queries: string[] = [];
  const client = {
    query: jest.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes("SELECT amount FROM liquidity_entries")) {
        return { rowCount: options.liquidity?.length ?? 1, rows: (options.liquidity ?? ["1000"]).map((amount) => ({ amount })) };
      }
      if (sql.includes("FROM settlements") && sql.includes("status IN")) {
        return { rowCount: options.committed?.length ?? 0, rows: options.committed ?? [] };
      }
      if (sql.includes("INSERT INTO settlements")) {
        return {
          rowCount: 1,
          rows: [{
            id: 7,
            anchor: "anchorA",
            asset: "USDC",
            amount: "400",
            fee: "1",
            status: "pending",
            created_at: new Date("2026-08-30T00:00:00.000Z"),
            cancel_reason: null,
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    }),
    release: jest.fn(),
  };
  poolMock.mockImplementationOnce(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue(client),
    end: jest.fn().mockResolvedValue(undefined),
  }));
  const database = new PostgresPersistence("postgres://localhost/anchornet");
  return { database, queries };
}

describe("PostgresPersistence settlement transaction", () => {
  afterEach(() => jest.clearAllMocks());

  it("locks the pool and committed settlements before inserting", async () => {
    const { database, queries } = makeDatabase();

    const settlement = await database.openSettlement({
      anchor: "anchorA",
      asset: "USDC",
      amount: 400n,
      fee: 1n,
      createdAt: "2026-08-30T00:00:00.000Z",
    });

    expect(settlement).toMatchObject({ id: 7, asset: "USDC", amount: 400n });
    expect(queries[0]).toBe("BEGIN");
    expect(queries.some((sql) => sql.includes("ORDER BY anchor FOR UPDATE"))).toBe(true);
    expect(queries.some((sql) => sql.includes("ORDER BY id FOR UPDATE"))).toBe(true);
    expect(queries.some((sql) => sql.includes("INSERT INTO settlements"))).toBe(true);
    expect(queries.at(-1)).toBe("COMMIT");
  });

  it("rejects capacity breaches and rolls back without inserting", async () => {
    const { database, queries } = makeDatabase({
      liquidity: ["1000"],
      committed: [{
        id: 1,
        anchor: "anchorA",
        asset: "USDC",
        amount: "800",
        fee: "1",
        status: "pending",
        created_at: new Date("2026-08-30T00:00:00.000Z"),
        cancel_reason: null,
      }],
    });

    await expect(database.openSettlement({
      anchor: "anchorA",
      asset: "USDC",
      amount: 201n,
      fee: 1n,
      createdAt: "2026-08-30T00:00:00.000Z",
    })).rejects.toThrow(/insufficient liquidity/);

    expect(queries.some((sql) => sql.includes("INSERT INTO settlements"))).toBe(false);
    expect(queries.at(-1)).toBe("ROLLBACK");
  });
});
