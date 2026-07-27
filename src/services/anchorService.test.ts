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

describe("AnchorService.registerBulk dry run", () => {
  function makeRepoAndService(): {
    repo: AnchorRepository;
    service: AnchorService;
  } {
    const repo = new AnchorRepository();
    return { repo, service: new AnchorService(repo) };
  }

  it("returns the would-be-registered anchors without persisting them", () => {
    const { repo, service } = makeRepoAndService();

    const result = service.registerBulk(
      [{ id: "anchorA" }, { id: "anchorB", name: "Anchor B" }],
      true,
    );

    expect(result.map((a) => a.id)).toEqual(["anchorA", "anchorB"]);
    expect(result[0].name).toBe("anchorA"); // name defaults to id
    expect(result[1].name).toBe("Anchor B");
    expect(result.every((a) => a.active === true)).toBe(true);
    expect(result.every((a) => typeof a.registeredAt === "string")).toBe(true);

    // Nothing was persisted.
    expect(repo.count()).toBe(0);
    expect(repo.all()).toEqual([]);
    expect(repo.has("anchorA")).toBe(false);
  });

  it("leaves the repository provably unchanged (count/all before and after)", () => {
    const { repo, service } = makeRepoAndService();
    service.register({ id: "existing" });

    const countBefore = repo.count();
    const allBefore = JSON.stringify(repo.all());

    service.registerBulk([{ id: "anchorA" }, { id: "anchorB" }], true);

    expect(repo.count()).toBe(countBefore);
    expect(JSON.stringify(repo.all())).toBe(allBefore);
  });

  it("never calls repo.upsert during a dry run", () => {
    const { repo, service } = makeRepoAndService();
    const upsert = jest.spyOn(repo, "upsert");

    service.registerBulk([{ id: "anchorA" }, { id: "anchorB" }], true);

    expect(upsert).not.toHaveBeenCalled();
  });

  it("persists when dryRun is false or omitted", () => {
    const { repo, service } = makeRepoAndService();

    service.registerBulk([{ id: "anchorA" }], false);
    service.registerBulk([{ id: "anchorB" }]);

    expect(repo.count()).toBe(2);
    expect(repo.all().map((a) => a.id)).toEqual(["anchorA", "anchorB"]);
  });

  it("reports the same outcome as a real call for a valid batch", () => {
    const dry = makeRepoAndService();
    const real = makeRepoAndService();
    const batch = [{ id: "anchorA" }, { id: "anchorB", name: "B" }];

    const dryResult = dry.service.registerBulk(batch, true);
    const realResult = real.service.registerBulk(batch, false);

    const strip = (anchors: { registeredAt?: string }[]) =>
      anchors.map((a) => ({ ...a, registeredAt: undefined }));

    expect(strip(dryResult)).toEqual(strip(realResult));
    expect(dry.repo.count()).toBe(0);
    expect(real.repo.count()).toBe(2);
  });

  it("rejects a non-array batch identically in dry-run mode", () => {
    const { repo, service } = makeRepoAndService();

    expect(() => service.registerBulk({ id: "anchorA" }, true)).toThrow(
      ApiError,
    );
    expect(repo.count()).toBe(0);
  });

  it("rejects an empty batch identically in dry-run mode", () => {
    const { service } = makeRepoAndService();

    expect(() => service.registerBulk([], true)).toThrow(ApiError);
  });

  it("rejects a null/undefined batch entry identically in both modes", () => {
    const dry = makeRepoAndService();
    const real = makeRepoAndService();

    const dryError = captureError(() =>
      dry.service.registerBulk([null, undefined], true),
    );
    const realError = captureError(() =>
      real.service.registerBulk([null, undefined], false),
    );

    expect(dryError?.status).toBe(400);
    expect(dryError?.message).toBe(realError?.message);
    expect(dry.repo.count()).toBe(0);
    expect(real.repo.count()).toBe(0);
  });

  it("rejects an invalid entry id identically in dry-run mode", () => {
    const { repo, service } = makeRepoAndService();

    expect(() => service.registerBulk([{ id: "" }], true)).toThrow(
      /"anchors\[0\]\.id" must be a non-empty string/,
    );
    expect(repo.count()).toBe(0);
  });

  it("rejects an invalid entry name identically in dry-run mode", () => {
    const { repo, service } = makeRepoAndService();

    expect(() =>
      service.registerBulk([{ id: "anchorA", name: 42 }], true),
    ).toThrow(/"anchors\[0\]\.name" must be a non-empty string/);
    expect(repo.count()).toBe(0);
  });

  it("rejects a duplicate id within the batch identically in dry-run mode", () => {
    const dry = makeRepoAndService();
    const real = makeRepoAndService();
    const batch = [{ id: "anchorA" }, { id: "anchorA" }];

    const dryError = captureError(() => dry.service.registerBulk(batch, true));
    const realError = captureError(() =>
      real.service.registerBulk(batch, false),
    );

    expect(dryError).toBeInstanceOf(ApiError);
    expect(dryError?.status).toBe(realError?.status);
    expect(dryError?.code).toBe(realError?.code);
    expect(dryError?.message).toBe(realError?.message);
    expect(dry.repo.count()).toBe(0);
    expect(real.repo.count()).toBe(0);
  });

  it("rejects an id that conflicts with the registry identically in dry-run mode", () => {
    const dry = makeRepoAndService();
    const real = makeRepoAndService();
    dry.service.register({ id: "anchorA" });
    real.service.register({ id: "anchorA" });
    const batch = [{ id: "anchorB" }, { id: "anchorA" }];

    const dryError = captureError(() => dry.service.registerBulk(batch, true));
    const realError = captureError(() =>
      real.service.registerBulk(batch, false),
    );

    expect(dryError?.status).toBe(409);
    expect(dryError?.status).toBe(realError?.status);
    expect(dryError?.message).toBe(realError?.message);

    // Neither mode registered the valid entry that preceded the conflict.
    expect(dry.repo.all().map((a) => a.id)).toEqual(["anchorA"]);
    expect(real.repo.all().map((a) => a.id)).toEqual(["anchorA"]);
  });

  it("does not consume ids, so the same batch can be dry-run repeatedly then committed", () => {
    const { repo, service } = makeRepoAndService();
    const batch = [{ id: "anchorA" }, { id: "anchorB" }];

    service.registerBulk(batch, true);
    service.registerBulk(batch, true);
    const committed = service.registerBulk(batch, false);

    expect(committed.map((a) => a.id)).toEqual(["anchorA", "anchorB"]);
    expect(repo.count()).toBe(2);
  });
});

/** Runs `fn` and returns the ApiError it threw, or `undefined`. */
function captureError(fn: () => unknown): ApiError | undefined {
  try {
    fn();
  } catch (error) {
    return error as ApiError;
  }
  return undefined;
}
