import request from "supertest";
import { createApp } from "../app";

describe("anchor routes", () => {
  it("registers an anchor", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA", name: "Anchor A" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("anchorA");
    expect(res.body.active).toBe(true);
  });

  it("rejects a duplicate anchor with 409", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    const res = await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("lists and reads anchors", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(1);

    const one = await request(app).get("/api/v1/anchors/anchorA");
    expect(one.status).toBe(200);
    expect(one.body.id).toBe("anchorA");
  });

  it("deactivates an anchor", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app).delete("/api/v1/anchors/anchorA");
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it("reactivates a deactivated anchor", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).delete("/api/v1/anchors/anchorA");

    const res = await request(app).post("/api/v1/anchors/anchorA/reactivate");
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
  });

  it("produces an audit log entry when reactivating an anchor, symmetric to deactivate", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).delete("/api/v1/anchors/anchorA");

    await request(app).post("/api/v1/anchors/anchorA/reactivate");

    const auditRes = await request(app).get("/api/v1/audit");
    expect(auditRes.status).toBe(200);

    const entries = auditRes.body.entries;

    const deactivateEntry = entries.find(
      (e: any) => e.method === "DELETE" && e.path === "/api/v1/anchors/anchorA",
    );
    expect(deactivateEntry).toBeDefined();
    expect(deactivateEntry).toMatchObject({
      method: "DELETE",
      path: "/api/v1/anchors/anchorA",
      status: 200,
    });
    expect(deactivateEntry).toHaveProperty("requestId");
    expect(deactivateEntry).toHaveProperty("timestamp");

    const reactivateEntry = entries.find(
      (e: any) =>
        e.method === "POST" && e.path === "/api/v1/anchors/anchorA/reactivate",
    );
    expect(reactivateEntry).toBeDefined();
    expect(reactivateEntry).toMatchObject({
      method: "POST",
      path: "/api/v1/anchors/anchorA/reactivate",
      status: 200,
    });
    expect(reactivateEntry).toHaveProperty("requestId");
    expect(reactivateEntry).toHaveProperty("timestamp");
  });

  it("returns 404 reactivating an unknown anchor", async () => {
    const res = await request(createApp()).post(
      "/api/v1/anchors/missing/reactivate",
    );
    expect(res.status).toBe(404);
  });

  it("partially updates an anchor's name", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA", name: "Old Name" });

    const res = await request(app)
      .patch("/api/v1/anchors/anchorA")
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
    expect(res.body.id).toBe("anchorA");

    const one = await request(app).get("/api/v1/anchors/anchorA");
    expect(one.body.name).toBe("New Name");
  });

  it("returns 404 patching an unknown anchor", async () => {
    const res = await request(createApp())
      .patch("/api/v1/anchors/missing")
      .send({ name: "New Name" });

    expect(res.status).toBe(404);
  });

  it("returns 400 patching an anchor without a name", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app).patch("/api/v1/anchors/anchorA").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 patching with an unknown field, naming it (#160)", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app)
      .patch("/api/v1/anchors/anchorA")
      .send({ name: "New Name", active: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.message).toMatch(/"active"/);

    // The silently-dropped update must not have taken effect.
    const one = await request(app).get("/api/v1/anchors/anchorA");
    expect(one.body.name).toBe("anchorA");
    expect(one.body.active).toBe(true);
  });

  it("returns 404 for an unknown anchor", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/anchors/missing");
    expect(res.status).toBe(404);
  });

  it("filters the anchor list by status", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).post("/api/v1/anchors").send({ id: "anchorB" });
    await request(app).delete("/api/v1/anchors/anchorB");

    const active = await request(app).get("/api/v1/anchors?status=active");
    expect(active.status).toBe(200);
    expect(active.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "anchorA",
    ]);

    const inactive = await request(app).get("/api/v1/anchors?status=inactive");
    expect(inactive.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "anchorB",
    ]);
  });

  it("returns 400 for an invalid status filter", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/anchors?status=bogus");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("sorts anchors by id in descending order", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).post("/api/v1/anchors").send({ id: "anchorB" });

    const res = await request(app).get("/api/v1/anchors?sort=id&order=desc");
    expect(res.status).toBe(200);
    expect(res.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "anchorB",
      "anchorA",
    ]);
  });

  it("returns 400 for an unknown sort field", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/anchors?sort=bogus");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("registers a batch of anchors via POST /bulk", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/anchors/bulk")
      .send({ anchors: [{ id: "anchorA" }, { id: "anchorB", name: "B" }] });

    expect(res.status).toBe(201);
    expect(res.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "anchorA",
      "anchorB",
    ]);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(2);
  });

  it("returns 409 and registers none of the bulk batch on conflict", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app)
      .post("/api/v1/anchors/bulk")
      .send({ anchors: [{ id: "anchorB" }, { id: "anchorA" }] });

    expect(res.status).toBe(409);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(1);
  });

  it("returns 400 for a bulk request with no anchors array", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/anchors/bulk").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("flags dryRun: false on a normal bulk registration", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/anchors/bulk")
      .send({ anchors: [{ id: "anchorA" }] });

    expect(res.status).toBe(201);
    expect(res.body.dryRun).toBe(false);
  });

  it("searches the anchor list via ?q=", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/anchors")
      .send({ id: "stellar-anchor", name: "Stellar Vault" });
    await request(app).post("/api/v1/anchors").send({ id: "other" });

    const res = await request(app).get("/api/v1/anchors?q=stellar");

    expect(res.status).toBe(200);
    expect(res.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "stellar-anchor",
    ]);
  });

  it("exports the anchor list as CSV via ?format=csv", async () => {
    const app = createApp();
    const registered = await request(app)
      .post("/api/v1/anchors")
      .send({ id: "anchorA" });

    const res = await request(app).get("/api/v1/anchors?format=csv");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toBe(
      `id,name,registeredAt,active\nanchorA,anchorA,${registered.body.registeredAt},true\n`,
    );
  });
});

describe("GET /api/v1/anchors/:id/settlements", () => {
  async function setupAnchorWithSettlements(app: ReturnType<typeof createApp>) {
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: 5000 });
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 200 });
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 300 });
  }

  it("returns settlements scoped to the anchor", async () => {
    const app = createApp();
    await setupAnchorWithSettlements(app);

    const res = await request(app).get("/api/v1/anchors/anchorA/settlements");

    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(3);
    expect(
      res.body.settlements.every(
        (s: { anchor: string }) => s.anchor === "anchorA",
      ),
    ).toBe(true);
  });

  it("returns 404 for an unknown anchor id", async () => {
    const app = createApp();

    const res = await request(app).get("/api/v1/anchors/unknown/settlements");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns an empty list when the anchor has no settlements", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app).get("/api/v1/anchors/anchorA/settlements");

    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it("does not include settlements from other anchors", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });
    await request(app).post("/api/v1/anchors").send({ id: "anchorB" });
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorA", asset: "USDC", amount: 5000 });
    await request(app)
      .post("/api/v1/liquidity")
      .send({ anchor: "anchorB", asset: "USDC", amount: 5000 });
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorA", asset: "USDC", amount: 100 });
    await request(app)
      .post("/api/v1/settlements")
      .send({ anchor: "anchorB", asset: "USDC", amount: 200 });

    const res = await request(app).get("/api/v1/anchors/anchorA/settlements");

    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(1);
    expect(res.body.settlements[0].anchor).toBe("anchorA");
  });

  it("returns the same shape as GET /api/v1/settlements?anchor=", async () => {
    const app = createApp();
    await setupAnchorWithSettlements(app);

    const nested = await request(app).get(
      "/api/v1/anchors/anchorA/settlements",
    );
    const filtered = await request(app).get(
      "/api/v1/settlements?anchor=anchorA",
    );

    expect(nested.status).toBe(200);
    expect(filtered.status).toBe(200);
    expect(nested.body.settlements).toEqual(filtered.body.settlements);
    expect(nested.body.pagination.total).toBe(filtered.body.pagination.total);
  });

  it("supports ?sort= and ?order= parameters", async () => {
    const app = createApp();
    await setupAnchorWithSettlements(app);

    const res = await request(app).get(
      "/api/v1/anchors/anchorA/settlements?sort=amount&order=asc",
    );

    expect(res.status).toBe(200);
    const amounts = res.body.settlements.map(
      (s: { amount: number }) => s.amount,
    );
    expect(amounts).toEqual([100, 200, 300]);
  });

  it("supports ?sort=amount&order=desc", async () => {
    const app = createApp();
    await setupAnchorWithSettlements(app);

    const res = await request(app).get(
      "/api/v1/anchors/anchorA/settlements?sort=amount&order=desc",
    );

    expect(res.status).toBe(200);
    const amounts = res.body.settlements.map(
      (s: { amount: number }) => s.amount,
    );
    expect(amounts).toEqual([300, 200, 100]);
  });

  it("supports ?page= and ?pageSize= parameters", async () => {
    const app = createApp();
    await setupAnchorWithSettlements(app);

    const res = await request(app).get(
      "/api/v1/anchors/anchorA/settlements?pageSize=2&page=1&sort=amount&order=asc",
    );

    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it("returns the second page correctly", async () => {
    const app = createApp();
    await setupAnchorWithSettlements(app);

    const res = await request(app).get(
      "/api/v1/anchors/anchorA/settlements?pageSize=2&page=2&sort=amount&order=asc",
    );

    expect(res.status).toBe(200);
    expect(res.body.settlements).toHaveLength(1);
    expect(res.body.settlements[0].amount).toBe(300);
    expect(res.body.pagination.page).toBe(2);
  });

  it("returns 400 for an invalid sort field", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app).get(
      "/api/v1/anchors/anchorA/settlements?sort=bogus",
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 for an invalid order value", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const res = await request(app).get(
      "/api/v1/anchors/anchorA/settlements?sort=id&order=sideways",
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("exports settlements as CSV via ?format=csv", async () => {
    const app = createApp();
    await setupAnchorWithSettlements(app);

    const res = await request(app).get(
      "/api/v1/anchors/anchorA/settlements?format=csv",
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toMatch(
      /^id,anchor,asset,amount,fee,status,createdAt,cancelReason\n/,
    );
    expect(res.text).toContain("anchorA");
  });
});

describe("POST /api/v1/anchors/bulk?dryRun=true", () => {
  it("validates the batch and registers nothing", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true")
      .send({ anchors: [{ id: "anchorA" }, { id: "anchorB", name: "B" }] });

    expect(res.status).toBe(201);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.anchors.map((a: { id: string }) => a.id)).toEqual([
      "anchorA",
      "anchorB",
    ]);
    expect(res.body.anchors[1].name).toBe("B");

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(0);
  });

  it("leaves the repository unchanged, verified before and after", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "existing" });

    const before = await request(app).get("/api/v1/anchors");

    await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true")
      .send({ anchors: [{ id: "anchorA" }, { id: "anchorB" }] });

    const after = await request(app).get("/api/v1/anchors");
    expect(after.body.anchors).toEqual(before.body.anchors);
    expect(after.body.anchors).toHaveLength(1);
  });

  it("returns the same 409 as a real call for an id already registered", async () => {
    const app = createApp();
    await request(app).post("/api/v1/anchors").send({ id: "anchorA" });

    const dry = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true")
      .send({ anchors: [{ id: "anchorB" }, { id: "anchorA" }] });
    const real = await request(app)
      .post("/api/v1/anchors/bulk")
      .send({ anchors: [{ id: "anchorB" }, { id: "anchorA" }] });

    expect(dry.status).toBe(409);
    expect(dry.status).toBe(real.status);
    expect(dry.body).toEqual(real.body);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(1);
  });

  it("returns the same 409 as a real call for a duplicate id within the batch", async () => {
    const app = createApp();

    const dry = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true")
      .send({ anchors: [{ id: "anchorA" }, { id: "anchorA" }] });
    const real = await request(app)
      .post("/api/v1/anchors/bulk")
      .send({ anchors: [{ id: "anchorA" }, { id: "anchorA" }] });

    expect(dry.status).toBe(409);
    expect(dry.body).toEqual(real.body);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(0);
  });

  it("returns 400 for a missing/empty anchors array in dry-run mode", async () => {
    const app = createApp();

    const missing = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true")
      .send({});
    const empty = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true")
      .send({ anchors: [] });

    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("BAD_REQUEST");
    expect(empty.status).toBe(400);
  });

  it("returns 400 for a blank entry id in dry-run mode", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true")
      .send({ anchors: [{ id: "anchorA" }, { id: "  " }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("anchors[1].id");

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(0);
  });

  it("performs a real registration for ?dryRun=false", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=false")
      .send({ anchors: [{ id: "anchorA" }] });

    expect(res.status).toBe(201);
    expect(res.body.dryRun).toBe(false);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(1);
  });

  it("accepts mixed casing and surrounding whitespace for the flag", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=%20TRUE%20")
      .send({ anchors: [{ id: "anchorA" }] });

    expect(res.status).toBe(201);
    expect(res.body.dryRun).toBe(true);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(0);
  });

  it("rejects an unrecognized dryRun value with 400 instead of registering", async () => {
    const app = createApp();

    for (const value of ["yes", "1", "ture"]) {
      const res = await request(app)
        .post(`/api/v1/anchors/bulk?dryRun=${value}`)
        .send({ anchors: [{ id: "anchorA" }] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.message).toContain("dryRun");
    }

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(0);
  });

  it("rejects a repeated dryRun query param with 400", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true&dryRun=true")
      .send({ anchors: [{ id: "anchorA" }] });

    expect(res.status).toBe(400);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(0);
  });

  it("treats a bare ?dryRun (no value) as invalid rather than a real write", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/anchors/bulk?dryRun")
      .send({ anchors: [{ id: "anchorA" }] });

    expect(res.status).toBe(400);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(0);
  });

  it("lets a dry run be followed by a real commit of the same batch", async () => {
    const app = createApp();
    const body = { anchors: [{ id: "anchorA" }, { id: "anchorB" }] };

    const dry = await request(app)
      .post("/api/v1/anchors/bulk?dryRun=true")
      .send(body);
    expect(dry.status).toBe(201);

    const real = await request(app).post("/api/v1/anchors/bulk").send(body);
    expect(real.status).toBe(201);

    const list = await request(app).get("/api/v1/anchors");
    expect(list.body.anchors).toHaveLength(2);
  });
});
