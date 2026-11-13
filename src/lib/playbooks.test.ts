import { describe, expect, it } from "vitest";
import { pickEcommerceColumns } from "./playbooks";

const col = (name: string, type = "VARCHAR") => ({ name, type });

describe("pickEcommerceColumns", () => {
  it("لا يعامل revenue كسعر وحدة ولا order_date كمعرّف طلب", () => {
    const r = pickEcommerceColumns([
      col("order_id"),
      col("order_date", "DATE"),
      col("quantity", "BIGINT"),
      col("unit_price", "DOUBLE"),
      col("revenue", "DOUBLE"),
    ]);
    expect(r).toEqual({ unitPrice: "unit_price", total: "revenue", qty: "quantity", order: "order_id" });
  });
  it("لا يعتبر عمود تاريخ الطلب معرّف طلب", () => {
    const r = pickEcommerceColumns([col("order_date", "DATE"), col("price", "DOUBLE")]);
    expect(r.order).toBeUndefined();
    expect(r.unitPrice).toBe("price");
  });
  it("عمود إجمالي فقط بلا سعر وحدة", () => {
    const r = pickEcommerceColumns([col("total_amount", "DOUBLE"), col("qty", "INTEGER")]);
    expect(r.unitPrice).toBeUndefined();
    expect(r.total).toBe("total_amount");
  });
  it("أسماء عربية", () => {
    const r = pickEcommerceColumns([col("رقم الطلب"), col("السعر", "DOUBLE"), col("الكمية", "INTEGER")]);
    expect(r.unitPrice).toBe("السعر");
    expect(r.qty).toBe("الكمية");
    expect(r.order).toBe("رقم الطلب");
  });
});
