/**
 * Generic in-memory repository base class.
 * Provides a shared Map, basic CRUD primitives, and numeric id generation.
 */
export abstract class InMemoryRepository<K, T> {
  protected readonly items = new Map<K, T>();
  protected nextId = 1;

  /** Returns the item associated with `key`, or `undefined`. */
  protected getByKey(key: K): T | undefined {
    return this.items.get(key);
  }

  /** Returns `true` if an item with `key` exists. */
  protected hasByKey(key: K): boolean {
    return this.items.has(key);
  }

  /** Inserts or updates an item under `key`. */
  protected upsertByKey(key: K, item: T): T {
    this.items.set(key, item);
    return item;
  }

  /** Removes an item by `key`, returning `true` if it existed. */
  protected removeByKey(key: K): boolean {
    return this.items.delete(key);
  }

  /** Returns all stored items. */
  protected listAll(): T[] {
    return [...this.items.values()];
  }

  /** Returns the total number of items stored. */
  protected countAll(): number {
    return this.items.size;
  }

  /** Clears all items. */
  protected clearAll(): void {
    this.items.clear();
  }

  /**
   * Generates and returns the next numeric id, incrementing the counter.
   *
   * NOTE (async-swap risk): `generateId()` and `peekId()` together form an
   * id-allocation scheme whose atomicity depends entirely on the synchronous,
   * single-threaded nature of this in-memory store. `peekId()` exposes the
   * id that `generateId()` will hand out next, but performs no locking. This
   * is safe today because Node serializes all synchronous code, so no other
   * mutation can occur between a `peekId()` and the caller's `generateId()`.
   * If a repository built on this base is ever swapped for an async-backed
   * (e.g. database) store, this assumption breaks and id allocation must be
   * made atomic (a single transactional allocation call) rather than a
   * separate peek + generate. See `docs/ARCHITECTURE.md`.
   */
  protected generateId(): number {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }

  /** Returns the next numeric id without incrementing. */
  protected peekId(): number {
    return this.nextId;
  }
}
