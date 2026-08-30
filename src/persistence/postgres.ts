/**
 * PostgreSQL persistence primitives.
 *
 * Repository methods in the original API are intentionally synchronous. This
 * module therefore owns the asynchronous boundary: state is hydrated before
 * the HTTP server binds, ordinary repository writes are serialized through a
 * durable queue, and settlement reservations use a database transaction with
 * row locks. The latter is important because checking a cached pool and then
 * inserting a settlement would re-introduce the oversubscription race this
 * issue is intended to remove.
 */

import { Pool, PoolClient, QueryResultRow } from "pg";
import { Anchor } from "../models/anchor";
import { LiquidityEntry } from "../models/liquidity";
import { Settlement, SettlementStatus } from "../models/settlement";

export interface PersistenceSnapshot {
  anchors: Anchor[];
  liquidity: LiquidityEntry[];
  settlements: Settlement[];
}

export interface SettlementDraft {
  anchor: string;
  asset: string;
  amount: bigint;
  fee: bigint;
  createdAt: string;
}

export class PostgresPersistence {
  readonly pool: Pool;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      application_name: "anchornet-backend",
    });
  }

  /** Fails before the server starts accepting traffic if PostgreSQL is down. */
  async assertReachable(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  /** Loads every durable aggregate before the app is constructed. */
  async loadSnapshot(): Promise<PersistenceSnapshot> {
    const [anchors, liquidity, settlements] = await Promise.all([
      this.pool.query<AnchorRow>(
        "SELECT id, name, registered_at, active FROM anchors ORDER BY id",
      ),
      this.pool.query<LiquidityRow>(
        "SELECT anchor, asset, amount, updated_at FROM liquidity_entries ORDER BY anchor, asset",
      ),
      this.pool.query<SettlementRow>(
        "SELECT id, anchor, asset, amount, fee, status, created_at, cancel_reason FROM settlements ORDER BY id",
      ),
    ]);

    return {
      anchors: anchors.rows.map((row) => ({
        id: row.id,
        name: row.name,
        registeredAt: row.registered_at.toISOString(),
        active: row.active,
      })),
      liquidity: liquidity.rows.map((row) => ({
        anchor: row.anchor,
        asset: row.asset,
        amount: BigInt(row.amount),
        updatedAt: row.updated_at.toISOString(),
      })),
      settlements: settlements.rows.map(toSettlement),
    };
  }

  /** Waits until all accepted write-behind operations have committed. */
  async flush(): Promise<void> {
    await this.writeQueue;
  }

  async close(): Promise<void> {
    await this.flush();
    await this.pool.end();
  }

  enqueue(operation: (client: PoolClient) => Promise<void>): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const client = await this.pool.connect();
      try {
        await operation(client);
      } finally {
        client.release();
      }
    });
    return this.writeQueue;
  }

  upsertAnchor(anchor: Anchor): Promise<void> {
    return this.enqueue((client) =>
      client.query(
        `INSERT INTO anchors (id, name, registered_at, active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active`,
        [anchor.id, anchor.name, anchor.registeredAt, anchor.active],
      ).then(() => undefined),
    );
  }

  removeAnchor(id: string): Promise<void> {
    return this.enqueue((client) =>
      client.query("DELETE FROM anchors WHERE id = $1", [id]).then(() => undefined),
    );
  }

  upsertLiquidity(entry: LiquidityEntry): Promise<void> {
    return this.enqueue((client) =>
      client.query(
        `INSERT INTO liquidity_entries (anchor, asset, amount, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (anchor, asset) DO UPDATE
         SET amount = EXCLUDED.amount, updated_at = EXCLUDED.updated_at`,
        [entry.anchor, entry.asset, entry.amount.toString(), entry.updatedAt],
      ).then(() => undefined),
    );
  }

  removeLiquidity(anchor: string, asset: string): Promise<void> {
    return this.enqueue((client) =>
      client.query(
        "DELETE FROM liquidity_entries WHERE anchor = $1 AND asset = $2",
        [anchor, asset],
      ).then(() => undefined),
    );
  }

  insertSettlement(settlement: Settlement): Promise<void> {
    return this.enqueue((client) =>
      client.query(
        `INSERT INTO settlements
          (id, anchor, asset, amount, fee, status, created_at, cancel_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           anchor = EXCLUDED.anchor, asset = EXCLUDED.asset,
           amount = EXCLUDED.amount, fee = EXCLUDED.fee,
           status = EXCLUDED.status, created_at = EXCLUDED.created_at,
           cancel_reason = EXCLUDED.cancel_reason`,
        [
          settlement.id,
          settlement.anchor,
          settlement.asset,
          settlement.amount.toString(),
          settlement.fee.toString(),
          settlement.status,
          settlement.createdAt,
          settlement.cancelReason ?? null,
        ],
      ).then(() => undefined),
    );
  }

  removeSettlement(id: number): Promise<void> {
    return this.enqueue((client) =>
      client.query("DELETE FROM settlements WHERE id = $1", [id]).then(() => undefined),
    );
  }

  /**
   * Atomically checks available liquidity and creates a pending settlement.
   * All rows for the asset are locked in a stable order, so concurrent callers
   * serialize on the same liquidity pool. Pending and executed settlements are
   * read while their rows are locked, making the accounting durable across
   * restarts and across multiple API instances.
   */
  async openSettlement(draft: SettlementDraft): Promise<Settlement> {
    await this.flush();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const liquidity = await client.query<{ amount: string }>(
        `SELECT amount FROM liquidity_entries
         WHERE asset = $1 ORDER BY anchor FOR UPDATE`,
        [draft.asset],
      );
      const settlements = await client.query<SettlementRow>(
        `SELECT id, anchor, asset, amount, fee, status, created_at, cancel_reason
         FROM settlements
         WHERE asset = $1 AND status IN ('pending', 'executed')
         ORDER BY id FOR UPDATE`,
        [draft.asset],
      );
      const total = liquidity.rows.reduce((sum, row) => sum + BigInt(row.amount), 0n);
      const committed = settlements.rows.reduce(
        (sum, row) => sum + BigInt(row.amount),
        0n,
      );
      const available = total - committed;
      if (available < draft.amount) {
        const error = new Error(
          `insufficient liquidity for ${draft.asset}: requested ${draft.amount}, available ${available}`,
        );
        error.name = "InsufficientLiquidityError";
        throw error;
      }

      const result = await client.query<SettlementRow>(
        `INSERT INTO settlements (anchor, asset, amount, fee, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', $5)
         RETURNING id, anchor, asset, amount, fee, status, created_at, cancel_reason`,
        [
          draft.anchor,
          draft.asset,
          draft.amount.toString(),
          draft.fee.toString(),
          draft.createdAt,
        ],
      );
      await client.query("COMMIT");
      return toSettlement(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async transitionSettlement(
    id: number,
    nextStatus: Exclude<SettlementStatus, "pending">,
    cancelReason?: string,
  ): Promise<Settlement> {
    await this.flush();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<SettlementRow>(
        `UPDATE settlements
         SET status = $2, cancel_reason = $3
         WHERE id = $1 AND status = 'pending'
         RETURNING id, anchor, asset, amount, fee, status, created_at, cancel_reason`,
        [id, nextStatus, cancelReason ?? null],
      );
      if (result.rowCount !== 1) {
        const current = await client.query<{ status: SettlementStatus }>(
          "SELECT status FROM settlements WHERE id = $1",
          [id],
        );
        const error = new Error(
          current.rowCount === 0
            ? `settlement ${id} not found`
            : `settlement ${id} is ${current.rows[0].status}, not pending`,
        );
        error.name = current.rowCount === 0 ? "SettlementNotFoundError" : "InvalidSettlementStateError";
        throw error;
      }
      await client.query("COMMIT");
      return toSettlement(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

interface AnchorRow extends QueryResultRow {
  id: string;
  name: string;
  registered_at: Date;
  active: boolean;
}

interface LiquidityRow extends QueryResultRow {
  anchor: string;
  asset: string;
  amount: string;
  updated_at: Date;
}

interface SettlementRow extends QueryResultRow {
  id: number;
  anchor: string;
  asset: string;
  amount: string;
  fee: string;
  status: SettlementStatus;
  created_at: Date;
  cancel_reason: string | null;
}

function toSettlement(row: SettlementRow): Settlement {
  return {
    id: Number(row.id),
    anchor: row.anchor,
    asset: row.asset,
    amount: BigInt(row.amount),
    fee: BigInt(row.fee),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    ...(row.cancel_reason === null ? {} : { cancelReason: row.cancel_reason }),
  };
}
