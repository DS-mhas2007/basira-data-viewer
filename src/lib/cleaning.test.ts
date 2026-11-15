import { describe, expect, it } from "vitest";
import { arabicNormExpr, buildStepSql, columnExpr, makeArabicStep } from "./cleaning";

describe("توحيد الكتابة العربية", () => {
  it("يحوّل الأرقام الهندية ويزيل التشكيل والتطويل", () => {
    const sql = arabicNormExpr("السعر");
    expect(sql).toContain("translate(");
    expect(sql).toContain("٠١٢٣٤٥٦٧٨٩");
    expect(sql).toContain("'01234567890123456789'");
    expect(sql).toContain("\\x{064B}");
    expect(sql).toContain("\\x{0640}");
  });

  it("يطبّق الخطوة على الأعمدة المحددة فقط", () => {
    const step = makeArabicStep(["a", "b"], ["a"], 3);
    expect(step.kind).toBe("arabic");
    expect(columnExpr(step, "a")).toContain("translate(");
    expect(columnExpr(step, "b")).toBe('"b"');
    expect(buildStepSql(step, "SELECT 1")).toContain('AS "a"');
  });

  it("الأرقام الهندية واللاتينية بنفس الطول (translate متوازن)", () => {
    const sql = arabicNormExpr("x");
    const m = /translate\(CAST\("x" AS VARCHAR\), '([^']+)', '([^']+)'\)/.exec(sql);
    expect(m).not.toBeNull();
    expect([...m![1]!].length).toBe([...m![2]!].length);
  });
});
