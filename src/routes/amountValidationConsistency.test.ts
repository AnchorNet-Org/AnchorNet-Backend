/**
 * Cross-route consistency test for non-positive `amount` validation.
 *
 * `QuoteService.quote`, `LiquidityService.addLiquidity`, and
 * `SettlementService.open` all validate their `amount` field through the same
 * `requirePositiveNumber` helper, so their rejection of a non-positive amount
 * must be observably identical at the HTTP boundary: a `400` carrying the
 * `BAD_REQUEST` error code and a message naming the offending `"amount"`
 * field.
 *
 * This guards a cross-cutting invariant that no single-route test can catch:
 * if one call site later switches to bespoke error handling (a different
 * status, a custom code, or a message that no longer names the field), this
 * test fails even though every per-route suite still passes.
 */

import request from "supertest";
import { createApp } from "../app";

/** Routes whose POST body carries an `amount` validated by the shared helper. */
const ROUTES: ReadonlyArray<{
  name: string;
  path: string;
  /** Body fields other than `amount`; all are valid so `amount` is the sole fault. */
  body: Record<string, unknown>;
}> = [
  {
    name: "POST /api/v1/quote (QuoteService.quote)",
    path: "/api/v1/quote",
    body: { asset: "USDC" },
  },
  {
    name: "POST /api/v1/liquidity (LiquidityService.addLiquidity)",
    path: "/api/v1/liquidity",
    body: { anchor: "anchorA", asset: "USDC" },
  },
  {
    name: "POST /api/v1/settlements (SettlementService.open)",
    path: "/api/v1/settlements",
    body: { anchor: "anchorA", asset: "USDC" },
  },
];

/** Non-positive values that must be rejected identically everywhere. */
const INVALID_AMOUNTS: ReadonlyArray<[label: string, amount: number]> = [
  ["zero", 0],
  ["negative", -1],
];

const cases = ROUTES.flatMap((route) =>
  INVALID_AMOUNTS.map(([label, amount]) => ({ ...route, label, amount })),
);

describe("non-positive amount validation is consistent across routes", () => {
  it.each(cases)(
    "$name rejects a $label amount with 400 BAD_REQUEST naming \"amount\"",
    async ({ path, body, amount }) => {
      const res = await request(createApp())
        .post(path)
        .send({ ...body, amount });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.message).toMatch(/amount/);
    },
  );

  it.each(INVALID_AMOUNTS)(
    "returns a byte-identical error envelope on every route for a %s amount",
    async (_label, amount) => {
      const app = createApp();
      const bodies = await Promise.all(
        ROUTES.map(async (route) => {
          const res = await request(app)
            .post(route.path)
            .send({ ...route.body, amount });
          expect(res.status).toBe(400);
          return res.body;
        }),
      );

      // Same shape *and* same message pattern: a divergence at any single call
      // site (custom code, reworded message, extra/missing fields) fails here.
      const [reference, ...rest] = bodies;
      expect(reference).toEqual({
        error: { code: "BAD_REQUEST", message: expect.stringMatching(/"amount"/) },
      });
      for (const body of rest) {
        expect(body).toEqual(reference);
      }
    },
  );
});
