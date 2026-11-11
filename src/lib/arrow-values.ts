/**
 * تحويل قيم Arrow القادمة من DuckDB-WASM إلى قيم صالحة للعرض والتصدير.
 * بدون ذلك: DATE/TIMESTAMP تظهر كـ epoch ms، وDECIMAL كنص مشوّه ("\"150\"" بدل 1.5).
 * typeId ثابتة في Apache Arrow: Decimal=7، Date=8، Time=9، Timestamp=10.
 */
export const ARROW_DECIMAL = 7;
export const ARROW_DATE = 8;
export const ARROW_TIME = 9;
export const ARROW_TIMESTAMP = 10;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** نص الأرقام غير المقيّسة (unscaled) + scale → رقم عشري. يعيد number إن كان آمناً، وإلا نصاً للحفاظ على الدقة. */
export function decimalToValue(unscaled: string, scale: number): number | string {
  const neg = unscaled.startsWith("-");
  const digits = unscaled.replace(/^-/, "").replace(/^0+(?=\d)/, "");
  let text: string;
  if (scale <= 0) {
    text = digits + "0".repeat(-scale);
  } else {
    const padded = digits.padStart(scale + 1, "0");
    const intPart = padded.slice(0, -scale);
    const frac = padded.slice(-scale).replace(/0+$/, "");
    text = frac ? `${intPart}.${frac}` : intPart;
  }
  if (neg && /[1-9]/.test(text)) text = `-${text}`;
  const significant = text.replace(/[-.]/g, "").replace(/^0+/, "").length;
  return significant <= 15 ? Number(text) : text;
}

export function convertCell(typeId: number | undefined, scale: number | undefined, v: unknown): unknown {
  if (v === null || v === undefined) return null;

  switch (typeId) {
    case ARROW_DECIMAL: {
      const raw = typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v);
      return /^-?\d+$/.test(raw) ? decimalToValue(raw, scale ?? 0) : raw;
    }
    case ARROW_DATE: {
      const d = new Date(Number(v));
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    case ARROW_TIMESTAMP: {
      const d = new Date(Number(v));
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().replace("T", " ").replace("Z", "").replace(/\.000$/, "");
    }
    case ARROW_TIME: {
      try {
        const micros = BigInt(String(v).replace(/n$/, ""));
        const sec = Number(micros / 1_000_000n);
        return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`;
      } catch {
        return String(v);
      }
    }
    default:
      break;
  }

  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
  return String(v);
}
