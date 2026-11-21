/** يقرّب الأعداد العشرية الطويلة (ضجيج الفاصلة العائمة) ويترك غيرها كما هي. */
export function formatCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value) && !Number.isInteger(value)) {
    return String(Math.round(value * 100) / 100);
  }
  return String(value);
}
