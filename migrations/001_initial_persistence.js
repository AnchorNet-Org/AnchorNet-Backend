/* eslint-disable no-undef */
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable("anchors", {
    id: { type: "text", primaryKey: true },
    name: { type: "text", notNull: true },
    registered_at: { type: "timestamptz", notNull: true },
    active: { type: "boolean", notNull: true, default: true },
  });

  pgm.createTable("liquidity_entries", {
    anchor: { type: "text", notNull: true, references: "anchors(id)", onDelete: "RESTRICT" },
    asset: { type: "text", notNull: true },
    amount: { type: "numeric(78,0)", notNull: true },
    updated_at: { type: "timestamptz", notNull: true },
  });
  pgm.addConstraint("liquidity_entries", "liquidity_entries_pkey", {
    primaryKey: ["anchor", "asset"],
  });
  pgm.addConstraint("liquidity_entries", "liquidity_amount_nonnegative", {
    check: "amount >= 0",
  });
  pgm.createIndex("liquidity_entries", ["asset", "anchor"]);

  pgm.createTable("settlements", {
    id: { type: "bigserial", primaryKey: true },
    anchor: { type: "text", notNull: true, references: "anchors(id)", onDelete: "RESTRICT" },
    asset: { type: "text", notNull: true },
    amount: { type: "numeric(78,0)", notNull: true },
    fee: { type: "numeric(78,0)", notNull: true },
    status: { type: "text", notNull: true, default: "pending" },
    created_at: { type: "timestamptz", notNull: true },
    cancel_reason: { type: "text" },
  });
  pgm.addConstraint("settlements", "settlement_amount_positive", { check: "amount > 0" });
  pgm.addConstraint("settlements", "settlement_fee_nonnegative", { check: "fee >= 0" });
  pgm.addConstraint("settlements", "settlement_status_valid", {
    check: "status IN ('pending', 'executed', 'cancelled')",
  });
  pgm.createIndex("settlements", ["anchor", "id"]);
  pgm.createIndex("settlements", ["asset", "id"]);
  pgm.createIndex("settlements", ["status", "id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("settlements");
  pgm.dropTable("liquidity_entries");
  pgm.dropTable("anchors");
};
