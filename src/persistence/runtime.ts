import { Config } from "../config";
import { PostgresPersistence, PersistenceSnapshot } from "./postgres";

export interface PersistenceRuntime {
  database: PostgresPersistence;
  snapshot: PersistenceSnapshot;
}

/**
 * Opens and hydrates the database once during process startup. Keeping this
 * lifecycle separate from createApp preserves the synchronous app factory
 * used by the unit and HTTP contract tests.
 */
export async function initializePersistence(config: Config): Promise<PersistenceRuntime> {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize PostgreSQL persistence");
  }
  const database = new PostgresPersistence(config.databaseUrl);
  try {
    await database.assertReachable();
    const snapshot = await database.loadSnapshot();
    return { database, snapshot };
  } catch (error) {
    await database.close().catch(() => undefined);
    throw new Error(
      `PostgreSQL persistence is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
