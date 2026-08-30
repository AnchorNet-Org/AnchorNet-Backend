# Cursor pagination

AnchorNet collection endpoints use cursor pagination by default. This keeps a
consumer from repeatedly scanning and counting a growing collection, and gives
callers a stable traversal boundary while new records are being added.

## Endpoints

The following collection reads support the cursor contract:

| Endpoint | Response collection | Canonical order |
| --- | --- | --- |
| `GET /api/v1/anchors` | `anchors` | `id` ascending |
| `GET /api/v1/anchors/:id/settlements` | `settlements` | `id` descending |
| `GET /api/v1/liquidity` | `pools` | `asset` ascending |
| `GET /api/v1/liquidity/entries` | `entries` | `anchor`, then `asset` ascending |
| `GET /api/v1/liquidity/withdrawals` | `withdrawals` | timestamp ascending, insertion index tie-breaker |
| `GET /api/v1/liquidity/anchors/:anchor` | `entries` | `asset` ascending |
| `GET /api/v1/settlements` | `settlements` | `id` descending |

Each response retains its existing collection property and adds a pagination
sibling:

```json
{
  "settlements": [],
  "pagination": {
    "pageSize": 20,
    "nextCursor": "eyJ2ZXJzaW9uIjoxLCJkaXJlY3Rpb24iOiJkZXNj..."
  }
}
```

The cursor is `null` when the page is the end of the collection. An empty
collection also returns `nextCursor: null`.

## Request parameters

`pageSize` is optional and defaults to `20`. Values greater than `100` are
clamped to `100`, which bounds the amount of work and response data per call.
Values must be positive integers. Decimals, negative numbers, exponents, and
non-numeric strings receive a `400` response.

`cursor` is optional on the first request. Follow-up requests pass the exact
opaque `nextCursor` value returned by the preceding response:

```text
GET /api/v1/settlements?pageSize=25
GET /api/v1/settlements?pageSize=25&cursor=<nextCursor>
```

The cursor is intentionally opaque. Clients must not decode it, construct it,
or depend on its current encoding. The current encoding includes a version,
direction, ordering boundary, and snapshot boundary so that the server can
reject a malformed cursor rather than silently skipping records.

## Snapshot behavior

The first page establishes a boundary at the first item in the canonical
ordering. A descending settlement traversal therefore excludes settlements
created after the first request, while an ascending anchor traversal excludes
anchors inserted before the first anchor in that traversal. This prevents a
consumer walking several pages from seeing a newly inserted record move an old
record onto an already-read page.

The snapshot boundary is not a database transaction and does not freeze updates
to existing objects. It is a traversal boundary for the collection ordering.
Records deleted between requests may disappear, which is preferable to
returning stale records that no longer exist.

## Ordering guarantees

Every cursor collection has one canonical order and a unique key:

1. anchors use the anchor id;
2. settlements use the numeric settlement id;
3. pools use the asset code;
4. global entries use the compound `(anchor, asset)` key;
5. anchor-scoped entries use the asset code;
6. withdrawals use `(timestamp, insertion index)`.

The unique tie-breaker is important for timestamps because multiple successful
withdrawals may be recorded during one clock tick. The tie-breaker makes the
cursor advance past exactly one record instead of skipping all records sharing
the same visible timestamp.

## Filters and scopes

Settlement cursors include the requested `anchor` and `asset` filters. Anchor
cursors include `status` and `q`. A cursor from one filtered collection cannot
be reused for another collection or filter set; the API returns `400` when the
scope does not match.

Anchor settlement cursors are scoped to their anchor id. Liquidity entry cursors
are scoped to the global entries collection or to the requested anchor. This
prevents an opaque value from accidentally being accepted by a different route.

## Canonical order versus legacy sorting

Existing offset pagination remains available for clients that send `page`, and
existing custom sorting remains available with that offset mode. A cursor request
must use the canonical order. Combining `cursor` with `sort` or `order` returns
`400` because the visible ordering would no longer match the cursor key.

The legacy shape includes `page`, `pageSize`, `total`, and `totalPages` in its
pagination object. Cursor mode intentionally reports only `pageSize` and
`nextCursor`; computing a total would reintroduce the full-collection scan that
cursor pagination is designed to avoid.

CSV exports remain full, sorted exports and ignore both pagination modes. This
keeps exports useful for operators while collection reads stay bounded.

## Client traversal algorithm

Clients should process each page before requesting the next one:

```text
cursor = absent
repeat:
    response = GET collection with pageSize and cursor
    process response.items
    cursor = response.pagination.nextCursor
until cursor is null
```

Clients should stop when `nextCursor` is `null`, not when the number of returned
items is less than `pageSize`. The latter is usually equivalent but does not
describe the server contract and is unsafe for future page-size policies.

If a cursor is malformed, expired by a future server version, or used with a
different filter, restart the traversal without a cursor. Do not retry the same
invalid value indefinitely.

## Error handling

Malformed cursors return the regular API error envelope with HTTP `400`:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "cursor is malformed or expired"
  }
}
```

The same response status is used for an incompatible direction, scope, or
page-size value. The API does not expose cursor internals in the error message.

## Database migration path

The current implementation applies the canonical ordering to service results
before passing them to the cursor helper. A future database-backed repository
can map the same keys to a `WHERE` predicate and `ORDER BY` clause:

* ascending traversal uses `key > after` and `key >= snapshot`;
* descending traversal uses `key < after` and `key <= snapshot`;
* compound keys must use the same lexicographic tuple order;
* the limit is `pageSize + 1` so the repository can determine `nextCursor`.

The application-level contract therefore does not depend on an in-memory
implementation. Repository adapters must preserve canonical ordering and the
same unique tie-breakers when they move filtering into SQL.

## Operational notes

The maximum page size is deliberately small enough for routine API calls and
large enough for normal dashboard batches. It is a server-side clamp, so an
untrusted caller cannot request an unbounded page by sending a very large
number.

The cursor helper validates unique keys in development and test paths. A
duplicate key is a programming error because it would make continuation
ambiguous; it is surfaced instead of producing a subtly incomplete traversal.

The helper never sorts or mutates its input. Routes own filtering and canonical
ordering, while the helper owns page-size validation, opaque cursor encoding,
snapshot filtering, continuation, and cursor validation. Keeping those
responsibilities separate makes the behavior easy to test and portable to a
database repository.

## Compatibility checklist

When adding a new cursor collection:

1. choose a deterministic canonical order;
2. add a unique key or compound key with a stable tie-breaker;
3. add a scope containing every filter that affects membership;
4. preserve the existing collection property in the JSON envelope;
5. document `cursor`, `pageSize`, order, and response pagination;
6. add tests for first page, continuation, empty data, malformed cursors, and
   records inserted between pages;
7. retain CSV and legacy offset behavior when compatibility requires it.

