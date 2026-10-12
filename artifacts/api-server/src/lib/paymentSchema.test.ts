import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  paymentRefundsTable,
  paymentSessionsTable,
} from "@workspace/db/schema";

describe("payment order key schema", () => {
  it("enforces order uniqueness with the declared non-null constraint", () => {
    expect(paymentSessionsTable.orderId.notNull).toBe(true);
    expect(paymentSessionsTable.orderId.isUnique).toBe(true);
    expect(paymentSessionsTable.orderId.uniqueName).toBe(
      "payment_sessions_order_id_key",
    );
  });

  it("does not redeclare the legacy FK-backed production index", () => {
    const indexes = getTableConfig(paymentSessionsTable).indexes;
    expect(indexes.map(index => index.config.name)).not.toContain(
      "payment_sessions_order_id_idx",
    );
  });

  it("preserves the refund relationship and restrict deletion behavior", () => {
    const relationships = getTableConfig(paymentRefundsTable).foreignKeys;
    const orderRelationship = relationships.find(foreignKey =>
      foreignKey.reference().columns.some(column => column.name === "order_id"),
    );

    expect(orderRelationship).toBeDefined();
    const reference = orderRelationship!.reference();
    expect(reference.foreignTable).toBe(paymentSessionsTable);
    expect(reference.columns.map(column => column.name)).toEqual(["order_id"]);
    expect(reference.foreignColumns.map(column => column.name)).toEqual(["order_id"]);
    expect(orderRelationship!.onDelete).toBe("restrict");
  });
});
