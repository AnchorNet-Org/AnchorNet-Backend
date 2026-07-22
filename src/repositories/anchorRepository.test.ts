import { AnchorRepository } from "./anchorRepository";
import { Anchor } from "../models/anchor";

function anchor(id: string, name = id): Anchor {
  return {
    id,
    name,
    registeredAt: "2024-01-01T00:00:00.000Z",
    active: true,
  };
}

describe("AnchorRepository", () => {
  it("upserts and retrieves anchors", () => {
    const repo = new AnchorRepository();
    repo.upsert(anchor("anchorA"));

    expect(repo.get("anchorA")?.id).toBe("anchorA");
    expect(repo.has("anchorA")).toBe(true);
    expect(repo.has("missing")).toBe(false);
  });

  it("returns anchors sorted by id", () => {
    const repo = new AnchorRepository();
    repo.upsert(anchor("zeta"));
    repo.upsert(anchor("alpha"));

    expect(repo.all().map((a) => a.id)).toEqual(["alpha", "zeta"]);
  });

  it("removes anchors and tracks the count", () => {
    const repo = new AnchorRepository();
    repo.upsert(anchor("anchorA"));
    expect(repo.count()).toBe(1);

    expect(repo.remove("anchorA")).toBe(true);
    expect(repo.remove("anchorA")).toBe(false);
    expect(repo.count()).toBe(0);
  });
  it("tracks active and inactive counts correctly", () => {
    const repo = new AnchorRepository();
    const a1 = anchor("a1", "A1"); // active
    const a2 = { ...anchor("a2", "A2"), active: false };
    const a3 = { ...anchor("a3", "A3"), active: false };

    repo.upsert(a1);
    repo.upsert(a2);
    repo.upsert(a3);
    expect(repo.countActive()).toBe(1);
    expect(repo.countInactive()).toBe(2);

    // Reactivate a2
    repo.upsert({ ...a2, active: true });
    expect(repo.countActive()).toBe(2);
    expect(repo.countInactive()).toBe(1);

    // Remove a3
    repo.remove("a3");
    expect(repo.countActive()).toBe(2);
    expect(repo.countInactive()).toBe(0);
  });

});
