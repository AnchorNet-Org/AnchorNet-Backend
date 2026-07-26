import { AnchorService } from "./anchorService";
import { AnchorRepository } from "../repositories/anchorRepository";
import { ApiError } from "../errors/ApiError";

function makeService(): AnchorService {
  return new AnchorService(new AnchorRepository());
}

describe("AnchorService", () => {
  it("registers an anchor and defaults the name to the id", () => {
    const service = makeService();
    const anchor = service.register({ id: "anchorA" });

    expect(anchor.name).toBe("anchorA");
    expect(anchor.active).toBe(true);
  });

  it("rejects a duplicate registration", () => {
    const service = makeService();
    service.register({ id: "anchorA" });

    expect(() => service.register({ id: "anchorA" })).toThrow(ApiError);
  });

  it("rejects a blank id", () => {
    const service = makeService();
    expect(() => service.register({ id: "" })).toThrow(ApiError);
  });

  it("throws 404 for an unknown anchor", () => {
    const service = makeService();
    expect(() => service.get("missing")).toThrow(ApiError);
  });

  it("deactivates an anchor on deregister", () => {
    const service = makeService();
    service.register({ id: "anchorA" });

    const updated = service.deregister("anchorA");
    expect(updated.active).toBe(false);
    expect(service.isActive("anchorA")).toBe(false);
  });

  it("reactivates a deactivated anchor", () => {
    const service = makeService();
    service.register({ id: "anchorA" });
    service.deregister("anchorA");

    const updated = service.reactivate("anchorA");
    expect(updated.active).toBe(true);
    expect(service.isActive("anchorA")).toBe(true);
  });

  it("throws 404 reactivating an unknown anchor", () => {
    const service = makeService();
    expect(() => service.reactivate("missing")).toThrow(ApiError);
  });

  it("updates an anchor's name", () => {
    const service = makeService();
    service.register({ id: "anchorA", name: "Old Name" });

    const updated = service.update("anchorA", { name: "New Name" });
    expect(updated.name).toBe("New Name");
    expect(service.get("anchorA").name).toBe("New Name");
  });

  it("leaves other fields untouched when updating the name", () => {
    const service = makeService();
    const original = service.register({ id: "anchorA" });

    const updated = service.update("anchorA", { name: "Renamed" });
    expect(updated.id).toBe(original.id);
    expect(updated.registeredAt).toBe(original.registeredAt);
    expect(updated.active).toBe(original.active);
  });

  it("throws 404 updating an unknown anchor", () => {
    const service = makeService();
    expect(() => service.update("missing", { name: "x" })).toThrow(ApiError);
  });

  it("rejects an update with no name provided", () => {
    const service = makeService();
    service.register({ id: "anchorA" });
    expect(() => service.update("anchorA", {})).toThrow(ApiError);
  });

  it("rejects an update with a blank name", () => {
    const service = makeService();
    service.register({ id: "anchorA" });
    expect(() => service.update("anchorA", { name: "  " })).toThrow(ApiError);
  });

  it("rejects an update carrying an unknown field, naming it (#160)", () => {
    const service = makeService();
    service.register({ id: "anchorA" });

    // A caller sending { name, active } must not get a silent partial update.
    expect(() =>
      service.update("anchorA", { name: "x", active: false } as {
        name?: unknown;
      }),
    ).toThrow(/unexpected field\(s\) in anchor update: "active"/);

    // The name change must NOT have been applied.
    expect(service.get("anchorA").name).toBe("anchorA");
    expect(service.get("anchorA").active).toBe(true);
  });

  it("rejects a typo of a real field instead of masking it (#160)", () => {
    const service = makeService();
    service.register({ id: "anchorA" });

    // `enabled` is a plausible typo of `active`; strict body catches it.
    expect(() =>
      service.update("anchorA", { name: "x", enabled: true } as {
        name?: unknown;
      }),
    ).toThrow(/"enabled"/);
  });

  it("names every unexpected field when several are sent (#160)", () => {
    const service = makeService();
    service.register({ id: "anchorA" });

    expect(() =>
      service.update("anchorA", { active: false, id: "other" } as {
        name?: unknown;
      }),
    ).toThrow(/"active", "id"/);
  });

  it("still accepts a name-only update unchanged (#160)", () => {
    const service = makeService();
    service.register({ id: "anchorA", name: "Old" });

    const updated = service.update("anchorA", { name: "New" });
    expect(updated.name).toBe("New");
  });

  it("returns every anchor when no status filter is given", () => {
    const service = makeService();
    service.register({ id: "anchorA" });
    service.register({ id: "anchorB" });
    service.deregister("anchorB");

    expect(service.list().map((a) => a.id)).toEqual(["anchorA", "anchorB"]);
  });

  it("filters anchors by active status", () => {
    const service = makeService();
    service.register({ id: "anchorA" });
    service.register({ id: "anchorB" });
    service.deregister("anchorB");

    expect(service.list({ status: "active" }).map((a) => a.id)).toEqual([
      "anchorA",
    ]);
  });

  it("filters anchors by inactive status", () => {
    const service = makeService();
    service.register({ id: "anchorA" });
    service.register({ id: "anchorB" });
    service.deregister("anchorB");

    expect(service.list({ status: "inactive" }).map((a) => a.id)).toEqual([
      "anchorB",
    ]);
  });

  it("rejects an invalid status filter", () => {
    const service = makeService();
    expect(() => service.list({ status: "bogus" })).toThrow(ApiError);
  });

  it("searches anchors by a case-insensitive id/name substring", () => {
    const service = makeService();
    service.register({ id: "stellar-anchor", name: "Stellar Vault" });
    service.register({ id: "other", name: "Something Else" });

    expect(service.list({ q: "STELLAR" }).map((a) => a.id)).toEqual([
      "stellar-anchor",
    ]);
    expect(service.list({ q: "vault" }).map((a) => a.id)).toEqual([
      "stellar-anchor",
    ]);
  });

  it("combines a search query with a status filter", () => {
    const service = makeService();
    service.register({ id: "anchorA", name: "Alpha" });
    service.register({ id: "anchorB", name: "Alpine" });
    service.deregister("anchorB");

    expect(
      service.list({ q: "al", status: "active" }).map((a) => a.id),
    ).toEqual(["anchorA"]);
  });

  it("returns an empty list when the search query matches nothing", () => {
    const service = makeService();
    service.register({ id: "anchorA" });

    expect(service.list({ q: "no-match" })).toEqual([]);
  });

  it("registers a batch of anchors", () => {
    const service = makeService();
    const registered = service.registerBulk([
      { id: "anchorA" },
      { id: "anchorB", name: "Anchor B" },
    ]);

    expect(registered.map((a) => a.id)).toEqual(["anchorA", "anchorB"]);
    expect(registered[1].name).toBe("Anchor B");
    expect(service.get("anchorA").active).toBe(true);
  });

  it("rejects a non-array batch", () => {
    const service = makeService();
    expect(() => service.registerBulk({ id: "anchorA" })).toThrow(ApiError);
  });

  it("rejects an empty batch", () => {
    const service = makeService();
    expect(() => service.registerBulk([])).toThrow(ApiError);
  });

  it("registers none of the batch if one entry is already registered", () => {
    const service = makeService();
    service.register({ id: "anchorA" });

    expect(() =>
      service.registerBulk([{ id: "anchorB" }, { id: "anchorA" }]),
    ).toThrow(ApiError);
    expect(service.list().map((a) => a.id)).toEqual(["anchorA"]);
  });

  it("rejects a batch with a duplicate id within itself", () => {
    const service = makeService();

    expect(() =>
      service.registerBulk([{ id: "anchorA" }, { id: "anchorA" }]),
    ).toThrow(ApiError);
    expect(service.list()).toEqual([]);
  });
});
