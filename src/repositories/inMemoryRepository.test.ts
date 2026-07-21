import { InMemoryRepository } from "./inMemoryRepository";

interface TestEntity {
  id: string;
  value: number;
}

class TestRepository extends InMemoryRepository<string, TestEntity> {
  // Expose protected methods as public for testing
  public get(key: string) { return this.getByKey(key); }
  public has(key: string) { return this.hasByKey(key); }
  public upsert(key: string, item: TestEntity) { return this.upsertByKey(key, item); }
  public remove(key: string) { return this.removeByKey(key); }
  public list() { return this.listAll(); }
  public count() { return this.countAll(); }
  public clear() { return this.clearAll(); }
  public genId() { return this.generateId(); }
  public peek() { return this.peekId(); }
}

describe("InMemoryRepository", () => {
  let repo: TestRepository;

  beforeEach(() => {
    repo = new TestRepository();
  });

  it("handles basic CRUD operations", () => {
    const item = { id: "a", value: 1 };
    
    expect(repo.has("a")).toBe(false);
    expect(repo.count()).toBe(0);

    repo.upsert("a", item);
    expect(repo.has("a")).toBe(true);
    expect(repo.get("a")).toEqual(item);
    expect(repo.count()).toBe(1);

    const list = repo.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(item);

    const removed = repo.remove("a");
    expect(removed).toBe(true);
    expect(repo.has("a")).toBe(false);
    expect(repo.count()).toBe(0);
    expect(repo.remove("a")).toBe(false); // second time returns false
  });

  it("clears all items", () => {
    repo.upsert("a", { id: "a", value: 1 });
    repo.upsert("b", { id: "b", value: 2 });
    expect(repo.count()).toBe(2);

    repo.clear();
    expect(repo.count()).toBe(0);
    expect(repo.list()).toHaveLength(0);
  });

  it("generates sequential numeric IDs", () => {
    expect(repo.peek()).toBe(1);
    expect(repo.genId()).toBe(1);
    expect(repo.peek()).toBe(2);
    expect(repo.genId()).toBe(2);
    expect(repo.genId()).toBe(3);
  });
});
