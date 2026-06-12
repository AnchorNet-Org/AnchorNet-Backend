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
});
