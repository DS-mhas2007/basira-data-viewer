import type { MIZYAiIconName } from "@/components/MIZYAiIcon";

const NAV_GLYPHS: Readonly<Partial<Record<string, MIZYAiIconName>>> = {
  home: "dashboard",
  data: "database",
  quality: "quality",
  analysis: "analytics",
  ask: "assistant",
  insights: "insights",
  whatif: "prediction",
  reports: "reports",
  board: "dashboard",
  alerts: "alerts",
  projects: "projects",
  settings: "settings",
  cleaning: "cleaning",
};

export function mizyaNavGlyph(id: string): MIZYAiIconName | undefined {
  return Object.hasOwn(NAV_GLYPHS, id) ? NAV_GLYPHS[id] : undefined;
}
