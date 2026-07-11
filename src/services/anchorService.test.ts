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

    expect(service.list("active").map((a) => a.id)).toEqual(["anchorA"]);
  });

  it("filters anchors by inactive status", () => {
    const service = makeService();
    service.register({ id: "anchorA" });
    service.register({ id: "anchorB" });
    service.deregister("anchorB");

    expect(service.list("inactive").map((a) => a.id)).toEqual(["anchorB"]);
  });

  it("rejects an invalid status filter", () => {
    const service = makeService();
    expect(() => service.list("bogus")).toThrow(ApiError);
  });
});
