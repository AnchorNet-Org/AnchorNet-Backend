# AnchorNet database migrations

Migrations are applied with `node-pg-migrate` and are intentionally separate
from application startup. Deployments should run `npm run migrate:up` before
starting the API; the API then verifies connectivity and fails fast if the
database cannot be reached.

```sh
DATABASE_URL=postgres://anchornet:secret@localhost:5432/anchornet npm run migrate:up
```

Amounts use PostgreSQL `numeric(78,0)`. JavaScript converts those values to
`bigint` at the repository boundary, so values larger than
`Number.MAX_SAFE_INTEGER` are not rounded. Foreign keys prevent orphaned
liquidity and settlement records, and settlement opening locks the relevant
pool rows before checking capacity.
