/**
 * الموجز الصوتي العربي — Web Speech API داخل المتصفح (بلا خوادم).
 */
import type { HealthReport } from "@/lib/data-health";
import type { DatasetProfile } from "@/lib/profile";
import { formatNumber } from "@/lib/profile";
import type { AnomalySignal } from "@/lib/anomaly-radar";

export function buildVoiceSummary(params: {
  fileName: string;
  health: HealthReport | null;
  profile: DatasetProfile | null;
  signals: AnomalySignal[];
  insights: string[];
}): string {
  const parts: string[] = ["أهلاً بك في بصيرة."];
  if (params.health) {
    parts.push(
      `تم تحليل ${params.health.rowCount.toLocaleString("ar-EG")} صفاً و${params.health.columnCount} عموداً.`,
      `درجة جودة البيانات ${Math.round(params.health.score)} من مئة.`,
    );
    if (params.health.missingRatio > 0.01) {
      parts.push(`نسبة القيم المفقودة ${(params.health.missingRatio * 100).toFixed(1)} بالمئة.`);
    }
    if (params.health.duplicateRows > 0) {
      parts.push(`ويوجد ${params.health.duplicateRows.toLocaleString("ar-EG")} صفاً مكرراً.`);
    }
  }
  const card = params.profile?.cards.find((c) => c.kind === "numeric");
  if (card && card.kind === "numeric") {
    parts.push(
      `في عمود ${card.column}، المتوسط ${formatNumber(card.avg)} وأعلى قيمة ${formatNumber(card.max)}.`,
    );
  }
  const cat = params.profile?.cards.find((c) => c.kind === "categorical");
  if (cat && cat.kind === "categorical" && cat.top[0]) {
    parts.push(`الفئة الأكثر تكراراً في ${cat.column} هي ${cat.top[0].label}.`);
  }
  for (const s of params.signals.slice(0, 2)) parts.push(`تنبيه: ${s.title}. ${s.detail}`);
  for (const i of params.insights.slice(0, 2)) parts.push(i);
  parts.push("تمت المعالجة محلياً بالكامل داخل متصفحك.");
  return parts.join(" ");
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickArabicVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang?.toLowerCase().startsWith("ar")) ?? null;
}

export function speak(text: string, onEnd?: () => void): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ar-SA";
  u.rate = 0.95;
  u.pitch = 1;
  const v = pickArabicVoice();
  if (v) u.voice = v;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}