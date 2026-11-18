import { describe, expect, it } from "vitest";
import { QuickAnalysisInput, buildSystemPrompt, type DatasetContext } from "./agent-chat";

const dataset: DatasetContext = {
  table: "dataset",
  rowCount: 2161,
  fileName: "all_data.csv",
  schema: [
    { name: "OrderDate", type: "VARCHAR" },
    { name: "TotalAmount", type: "DOUBLE" },
    { name: "CustomerID", type: "INTEGER" },
  ],
};

describe("MIZYAi unified analyst routing contract", () => {
  it("routes a single direct metric to quick_analysis", () => {
    const prompt = buildSystemPrompt(dataset);

    expect(prompt).toContain("quick_analysis");
    expect(prompt).toContain("COUNT أو SUM أو AVG");
    expect(prompt).toContain("لا تستخدمه بديلاً عن quick_analysis");
  });

  it("keeps compound SQL work on the agent run_sql path", () => {
    const prompt = buildSystemPrompt(dataset);

    expect(prompt).toContain("run_sql");
    expect(prompt).toContain("أكثر من استعلام/مرحلة");
    expect(prompt).toContain("مقارنة متعددة الأبعاد");
  });

  it("does not permit invented metrics from the preview sample", () => {
    const prompt = buildSystemPrompt(dataset);

    expect(prompt).toContain("لا تخترع أرقاماً أبداً");
    expect(prompt).toContain("quick_analysis أو run_sql");
    expect(prompt).toContain("ولا تستنتجه من عينة الصفوف");
  });

  it("keeps destructive or persistence tools behind explicit user intent", () => {
    const prompt = buildSystemPrompt(dataset);

    expect(prompt).toContain("الموافقة الصريحة عليه");
    expect(prompt).toContain("فقط عند طلب تثبيت نتيجة");
  });

  it("asks for clarification when metric semantics are ambiguous", () => {
    expect(buildSystemPrompt(dataset)).toContain(
      "اطلب توضيحاً بدلاً من تخمين تعريف المقياس",
    );
  });

  it("accepts a non-empty bounded quick-analysis question", () => {
    expect(QuickAnalysisInput.safeParse({ question: "كم عدد الطلبات؟" }).success).toBe(true);
    expect(QuickAnalysisInput.safeParse({ question: "   " }).success).toBe(false);
    expect(QuickAnalysisInput.safeParse({ question: "س".repeat(501) }).success).toBe(false);
  });

  it("does not offer data analysis before a dataset is uploaded", () => {
    const prompt = buildSystemPrompt(null);

    expect(prompt).toContain("لم يرفع المستخدم أي ملف بعد");
    expect(prompt).toContain("اطلب منه رفع ملف CSV أو Excel");
    expect(prompt).not.toContain("quick_analysis");
  });
});
