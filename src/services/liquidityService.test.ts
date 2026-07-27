import { LiquidityService } from "./liquidityService";
import { LiquidityRepository } from "../repositories/liquidityRepository";
import { SettlementService } from "./settlementService";
import { SettlementRepository } from "../repositories/settlementRepository";
import { AnchorService } from "./anchorService";
import { AnchorRepository } from "../repositories/anchorRepository";
import { ApiError } from "../errors/ApiError";

function makeService(): LiquidityService {
  return new LiquidityService(new LiquidityRepository());
}

describe("LiquidityService", () => {
  it("records liquidity and normalizes the asset code", () => {
    const service = makeService();
    const entry = service.addLiquidity({
      anchor: "anchorA",
      asset: "usdc",
      amount: 100,
    });

    expect(entry.asset).toBe("USDC");
    expect(entry.amount).toBe(100);
  });

  it("accumulates repeated contributions from the same anchor", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 50 });

    const pool = service.getPool("USDC");
    expect(pool.total).toBe(150);
    expect(pool.anchors).toBe(1);
    expect(pool.lastUpdated).toBeDefined();
  });

  it("rejects non-positive amounts", () => {
    const service = makeService();
    expect(() =>
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: -5 }),
    ).toThrow(ApiError);
  });

  it("rejects a blank anchor", () => {
    const service = makeService();
    expect(() =>
      service.addLiquidity({ anchor: "  ", asset: "USDC", amount: 5 }),
    ).toThrow(ApiError);
  });

  it("lists pools sorted by asset", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
    service.addLiquidity({ anchor: "anchorB", asset: "EURC", amount: 40 });

    expect(service.listPools().map((p) => p.asset)).toEqual(["EURC", "USDC"]);
  });

  it("throws 404 for an unknown pool", () => {
    const service = makeService();
    expect(() => service.getPool("USDC")).toThrow(ApiError);
  });

  it("withdraws part of an anchor's balance", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const entry = service.withdrawLiquidity({
      anchor: "anchorA",
      asset: "usdc",
      amount: 40,
    });

    expect(entry.amount).toBe(60);
    expect(service.getPool("USDC").total).toBe(60);
  });

  it("removes the entry once the full balance is withdrawn", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const entry = service.withdrawLiquidity({
      anchor: "anchorA",
      asset: "USDC",
      amount: 100,
    });

    expect(entry.amount).toBe(0);
    expect(() => service.getPool("USDC")).toThrow(ApiError);
  });

  it("rejects withdrawing more than the available balance", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    expect(() =>
      service.withdrawLiquidity({
        anchor: "anchorA",
        asset: "USDC",
        amount: 150,
      }),
    ).toThrow(ApiError);
  });

  it("throws 404 when the anchor has no balance to withdraw", () => {
    const service = makeService();
    expect(() =>
      service.withdrawLiquidity({
        anchor: "anchorA",
        asset: "USDC",
        amount: 10,
      }),
    ).toThrow(ApiError);
  });

  it("removes an entire entry with normalized inputs", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    const removed = service.removeEntry(" anchorA ", "usdc");

    expect(removed).toMatchObject({
      anchor: "anchorA",
      asset: "USDC",
      amount: 100,
    });
    expect(service.listEntries()).toEqual([]);
  });

  it("throws 404 when removing a non-existent entry", () => {
    const service = makeService();

    expect(() => service.removeEntry("anchorA", "USDC")).toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("lists entries by anchor", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
    service.addLiquidity({ anchor: "anchorB", asset: "USDC", amount: 50 });
    service.addLiquidity({ anchor: "anchorA", asset: "EURC", amount: 75 });

    const entriesA = service.listByAnchor("anchorA");
    expect(entriesA).toHaveLength(2);
    expect(entriesA.map((e) => e.asset).sort()).toEqual(["EURC", "USDC"]);

    const entriesB = service.listByAnchor("anchorB");
    expect(entriesB).toHaveLength(1);
    expect(entriesB[0].asset).toBe("USDC");
  });

  describe("transferLiquidity", () => {
    it("moves liquidity between two anchors atomically in one operation", () => {
      const service = makeService();
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
      service.addLiquidity({ anchor: "anchorB", asset: "USDC", amount: 50 });

      const result = service.transferLiquidity({
        from: "anchorA",
        to: "anchorB",
        asset: "usdc",
        amount: 40,
      });

      expect(result.from).toMatchObject({
        anchor: "anchorA",
        asset: "USDC",
        amount: 60,
      });
      expect(result.to).toMatchObject({
        anchor: "anchorB",
        asset: "USDC",
        amount: 90,
      });
      // The pool total is unchanged: the transfer never reduced it.
      expect(service.getPool("USDC").total).toBe(150);
    });

    it("creates the destination entry when the target anchor has none", () => {
      const service = makeService();
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

      const result = service.transferLiquidity({
        from: "anchorA",
        to: "anchorB",
        asset: "USDC",
        amount: 25,
      });

      expect(result.to.amount).toBe(25);
      expect(service.listByAnchor("anchorB")).toHaveLength(1);
      expect(service.getPool("USDC").total).toBe(100);
    });

    it("removes the source entry once its full balance is transferred", () => {
      const service = makeService();
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
      service.addLiquidity({ anchor: "anchorB", asset: "USDC", amount: 10 });

      const result = service.transferLiquidity({
        from: "anchorA",
        to: "anchorB",
        asset: "USDC",
        amount: 100,
      });

      expect(result.from.amount).toBe(0);
      expect(result.to.amount).toBe(110);
      expect(service.listByAnchor("anchorA")).toHaveLength(0);
      expect(service.getPool("USDC").total).toBe(110);
    });

    it("leaves both anchors' balances unchanged when the source is insufficient", () => {
      const service = makeService();
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
      service.addLiquidity({ anchor: "anchorB", asset: "USDC", amount: 50 });

      expect(() =>
        service.transferLiquidity({
          from: "anchorA",
          to: "anchorB",
          asset: "USDC",
          amount: 150,
        }),
      ).toThrow(
        expect.objectContaining({
          status: 400,
          code: "INSUFFICIENT_LIQUIDITY",
        }),
      );

      // Atomicity: neither side moved and the pool total is intact.
      expect(service.listByAnchor("anchorA")[0].amount).toBe(100);
      expect(service.listByAnchor("anchorB")[0].amount).toBe(50);
      expect(service.getPool("USDC").total).toBe(150);
    });

    it("throws 404 without creating a destination entry when the source has no balance", () => {
      const service = makeService();
      service.addLiquidity({ anchor: "anchorB", asset: "USDC", amount: 50 });

      expect(() =>
        service.transferLiquidity({
          from: "anchorA",
          to: "anchorB",
          asset: "USDC",
          amount: 10,
        }),
      ).toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));

      expect(service.listByAnchor("anchorA")).toHaveLength(0);
      expect(service.listByAnchor("anchorB")[0].amount).toBe(50);
      expect(service.getPool("USDC").total).toBe(50);
    });

    it("rejects a transfer to the same anchor without changing its balance", () => {
      const service = makeService();
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

      expect(() =>
        service.transferLiquidity({
          from: "anchorA",
          to: "anchorA",
          asset: "USDC",
          amount: 50,
        }),
      ).toThrow(ApiError);

      expect(service.listByAnchor("anchorA")[0].amount).toBe(100);
      expect(service.getPool("USDC").total).toBe(100);
    });

    it("rejects invalid inputs without changing any balance", () => {
      const service = makeService();
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

      const badInputs = [
        { from: "  ", to: "anchorB", asset: "USDC", amount: 10 },
        { from: "anchorA", to: "", asset: "USDC", amount: 10 },
        { from: "anchorA", to: "anchorB", asset: "USDC", amount: -5 },
        { from: "anchorA", to: "anchorB", asset: "USDC", amount: 0 },
        {
          from: "anchorA",
          to: "anchorB",
          asset: "TOOLONGASSETCODE",
          amount: 10,
        },
      ];
      for (const input of badInputs) {
        expect(() => service.transferLiquidity(input)).toThrow(ApiError);
      }

      expect(service.listByAnchor("anchorA")[0].amount).toBe(100);
      expect(service.listByAnchor("anchorB")).toHaveLength(0);
      expect(service.getPool("USDC").total).toBe(100);
    });

    it("does not touch balances in other assets", () => {
      const service = makeService();
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
      service.addLiquidity({ anchor: "anchorA", asset: "EURC", amount: 75 });

      service.transferLiquidity({
        from: "anchorA",
        to: "anchorB",
        asset: "USDC",
        amount: 40,
      });

      const anchorAEurc = service
        .listByAnchor("anchorA")
        .find((e) => e.asset === "EURC");
      expect(anchorAEurc?.amount).toBe(75);
      expect(service.getPool("EURC").total).toBe(75);
    });
  });
});

describe("LiquidityService withdrawal history", () => {
  it("starts with no recorded withdrawals", () => {
    const service = makeService();
    expect(service.listWithdrawals()).toEqual([]);
  });

  it("records a successful partial withdrawal with amount, balance and timestamp", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    service.withdrawLiquidity({ anchor: "anchorA", asset: "usdc", amount: 40 });

    const records = service.listWithdrawals();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      anchor: "anchorA",
      asset: "USDC",
      amount: 40,
      remainingBalance: 60,
      timestamp: expect.any(String),
    });
    // Timestamp is a valid ISO-8601 date.
    expect(new Date(records[0].timestamp).toString()).not.toBe("Invalid Date");
  });

  it("records a remainingBalance of 0 when the full balance is withdrawn", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });

    service.withdrawLiquidity({
      anchor: "anchorA",
      asset: "USDC",
      amount: 100,
    });

    expect(service.listWithdrawals()).toEqual([
      {
        anchor: "anchorA",
        asset: "USDC",
        amount: 100,
        remainingBalance: 0,
        timestamp: expect.any(String),
      },
    ]);
  });

  it("records multiple withdrawals in chronological order (oldest first)", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
    service.addLiquidity({ anchor: "anchorB", asset: "EURC", amount: 50 });

    service.withdrawLiquidity({ anchor: "anchorA", asset: "USDC", amount: 30 });
    service.withdrawLiquidity({ anchor: "anchorB", asset: "EURC", amount: 20 });

    const records = service.listWithdrawals();
    expect(records.map((r) => r.anchor)).toEqual(["anchorA", "anchorB"]);
    expect(records.map((r) => r.remainingBalance)).toEqual([70, 30]);
  });

  it("does not record a withdrawal that fails for insufficient balance", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 50 });

    expect(() =>
      service.withdrawLiquidity({
        anchor: "anchorA",
        asset: "USDC",
        amount: 80,
      }),
    ).toThrow(ApiError);

    expect(service.listWithdrawals()).toEqual([]);
  });

  it("does not record a withdrawal when the anchor has no balance", () => {
    const service = makeService();

    expect(() =>
      service.withdrawLiquidity({
        anchor: "anchorA",
        asset: "USDC",
        amount: 10,
      }),
    ).toThrow(ApiError);

    expect(service.listWithdrawals()).toEqual([]);
  });

  it("does not record a withdrawal that breaches reserved liquidity", () => {
    const liquidityRepo = new LiquidityRepository();
    const settlementRepo = new SettlementRepository();
    const anchorRepo = new AnchorRepository();
    const anchors = new AnchorService(anchorRepo);
    anchors.register({ id: "anchorA" });
    const settlements = new SettlementService(
      settlementRepo,
      liquidityRepo,
      anchors,
    );
    const liquidity = new LiquidityService(liquidityRepo, settlements);

    liquidity.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 1000 });
    settlements.open({ anchor: "anchorA", asset: "USDC", amount: 800 });

    expect(() =>
      liquidity.withdrawLiquidity({
        anchor: "anchorA",
        asset: "USDC",
        amount: 300,
      }),
    ).toThrow(ApiError);

    expect(liquidity.listWithdrawals()).toEqual([]);
  });

  it("bounds the history to the most recent records (FIFO eviction)", () => {
    const service = makeService();
    // 101 successful withdrawals: top up `i+1` then withdraw `i+1` each
    // iteration so the balance returns to zero and never runs dry. Each record
    // is distinguishable by its amount (1..101). The bound (100) must evict the
    // oldest record, leaving amounts 2..101.
    for (let i = 0; i < 101; i++) {
      service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: i + 1 });
      service.withdrawLiquidity({
        anchor: "anchorA",
        asset: "USDC",
        amount: i + 1,
      });
    }

    const records = service.listWithdrawals();
    expect(records).toHaveLength(100);
    expect(records.map((r) => r.amount)).toEqual(
      Array.from({ length: 100 }, (_, k) => k + 2), // 2..101
    );
    expect(records[99].amount).toBe(101); // newest retained
  });

  it("returns a snapshot copy that does not allow external mutation", () => {
    const service = makeService();
    service.addLiquidity({ anchor: "anchorA", asset: "USDC", amount: 100 });
    service.withdrawLiquidity({ anchor: "anchorA", asset: "USDC", amount: 40 });

    const snapshot = service.listWithdrawals();
    snapshot.push({
      anchor: "tampered",
      asset: "X",
      amount: 1,
      remainingBalance: 1,
      timestamp: "nope",
    });

    expect(service.listWithdrawals()).toHaveLength(1);
  });
});
