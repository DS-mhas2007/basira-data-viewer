export type WorkspaceTool = "data" | "quality" | "analysis" | "insights" | "ask";

export interface GuideToolLink {
  tool: WorkspaceTool;
  label: string;
  prompt?: string;
}

export const GUIDE_TOOL_LINKS: Record<string, GuideToolLink> = {
  "/guide/arabic-csv-excel": { tool: "data", label: "افتح استيراد البيانات ومراجعة الملف" },
  "/guide/arabic-text-cleaning": { tool: "quality", label: "افتح تنظيف البيانات" },
  "/guide/ask-data-in-arabic": {
    tool: "ask",
    label: "اسأل MIZYAi عن بياناتك",
    prompt: "حلّل هذا الملف بالعربية، واقترح أسئلة مفيدة يمكن الإجابة عنها من أعمدته، واشرح الأدلة وراء النتائج.",
  },
  "/guide/chart-interpretation": { tool: "analysis", label: "افتح التحليل والرسوم البيانية" },
  "/guide/choose-chart": { tool: "analysis", label: "افتح استوديو الرسوم البيانية" },
  "/guide/correlation-analysis": { tool: "analysis", label: "افتح التحليل لاستكشاف العلاقات" },
  "/guide/csv-vs-excel": { tool: "data", label: "افتح استيراد البيانات" },
  "/guide/data-dictionary": { tool: "data", label: "افتح البيانات وقاموس الأعمدة" },
  "/guide/data-privacy-browser": { tool: "data", label: "ابدأ باستيراد ملفك محلياً" },
  "/guide/data-quality-score": { tool: "quality", label: "افتح فحص جودة البيانات" },
  "/guide/data-types": { tool: "data", label: "افتح البيانات وافحص أنواع الأعمدة" },
  "/guide/date-format": { tool: "data", label: "افتح البيانات لمراجعة التواريخ" },
  "/guide/descriptive-statistics": { tool: "analysis", label: "افتح التحليل والإحصاءات" },
  "/guide/fix-arabic-encoding": { tool: "data", label: "افتح استيراد البيانات والترميز" },
  "/guide/missing-values": { tool: "quality", label: "افتح تنظيف القيم المفقودة" },
  "/guide/outlier-detection": { tool: "analysis", label: "افتح التحليل لفحص التوزيعات" },
  "/guide/pivot-alternative": { tool: "analysis", label: "افتح التحليل والجداول الملخّصة" },
  "/guide/remove-duplicates": { tool: "quality", label: "افتح تنظيف التكرارات" },
  "/guide/sql-basics": {
    tool: "ask",
    label: "اسأل MIZYAi عن استعلام التحليل",
    prompt: "ساعدني في صياغة استعلام تحليلي مناسب لهذه البيانات. وضّح الحقول والتصفية والتجميع، واشرح منطق SQL خطوة بخطوة قبل اعتماد أي نتيجة.",
  },
  "/guide/time-series-analysis": { tool: "analysis", label: "افتح التحليل الزمني والرسوم" },
};

const WORKSPACE_TOOLS = new Set<WorkspaceTool>(["data", "quality", "analysis", "insights", "ask"]);

export function getGuideToolLink(pathname: string): (GuideToolLink & { href: string }) | null {
  const target = GUIDE_TOOL_LINKS[pathname.replace(/\/$/, "")];
  if (!target) return null;

  const params = new URLSearchParams({ tool: target.tool });
  if (target.prompt) params.set("prompt", target.prompt);
  return { ...target, href: `/?${params.toString()}` };
}

export function readGuideToolIntent(search: string): { tool: WorkspaceTool; prompt?: string } | null {
  const params = new URLSearchParams(search);
  const tool = params.get("tool");
  if (!tool || !WORKSPACE_TOOLS.has(tool as WorkspaceTool)) return null;

  const prompt = params.get("prompt")?.trim();
  return {
    tool: tool as WorkspaceTool,
    ...(tool === "ask" && prompt ? { prompt } : {}),
  };
}
