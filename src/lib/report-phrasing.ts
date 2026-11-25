/**
 * تنويع صياغة نصوص التقرير دون المساس بالأرقام:
 *  - كل نوع جملة له عدة صيغ متكافئة المعنى تحمل نفس الأرقام تماماً.
 *  - الاختيار حتمي (hash لمعرّف الاستنتاج): نفس البيانات تعطي نفس النص دائماً،
 *    لكن الاستنتاجات المتجاورة لا تتكرر بنفس الأسلوب.
 *  - "ذيل المجال" جملة إجراء قصيرة خاصة بنوع البيانات (playbook) تُضاف للتوصيات فقط، بلا أي رقم جديد.
 */
import type { PlaybookId } from "@/lib/playbooks";

/** djb2 → عدد صحيح موجب ثابت. */
export function stableHash(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** يختار صيغة ثابتة لمفتاح معيّن؛ salt يفصل بين أنواع الجمل كي لا تتزامن اختياراتها. */
export function pickVariant<T>(key: string, variants: readonly T[], salt = ""): T {
  return variants[stableHash(`${salt}|${key}`) % variants.length]!;
}

export type DomainIntent =
  "ranking" | "compare" | "trend" | "distribution" | "anomaly" | "summary" | "default";

/** جملة إجراء خاصة بالمجال؛ بلا أرقام حتى لا تحتاج مصدراً. */
const DOMAIN_TAILS: Partial<Record<PlaybookId, Partial<Record<DomainIntent, readonly string[]>>>> =
  {
    ecommerce: {
      ranking: [
        "اربط أداء المنتجات الأعلى بمستوى المخزون المتاح قبل الحملة القادمة.",
        "تأكد أن المنتجات المتصدرة متوفرة بكميات كافية، وأن الأدنى ليست ضحية تسعير أو عرض.",
      ],
      trend: [
        "قارن هذا الاتجاه بمواسم الحملات والعروض لتفصل أثر التسويق عن الطلب الطبيعي.",
        "راجع تزامن الاتجاه مع التخفيضات أو تغيّر الأسعار قبل اعتماده كطلب حقيقي.",
      ],
      distribution: ["افحص اعتماد الإيراد على عدد محدود من المنتجات أو القنوات وقيّم خطر التركّز."],
      default: ["حوّل هذا الاستنتاج إلى إجراء تجاري محدد: تسعير، مخزون، أو حملة."],
    },
    hr: {
      ranking: [
        "راجع عدالة توزيع الأجور بين الأقسام ومستوى الأقدمية قبل أي قرار بشأن الرواتب.",
        "قارن الفروق بين الأقسام بعبء العمل والخبرة حتى لا يُقرأ الفرق كأنه تفاوت غير مبرَّر.",
      ],
      distribution: [
        "تحقق من أن التوزيع بين الأقسام أو الفئات الوظيفية يعكس الهيكل المعتمد وليس خللاً في التسجيل.",
      ],
      trend: ["اربط الاتجاه بالتعيينات والاستقالات في الفترة نفسها قبل تفسيره."],
      default: ["اعرض النتيجة على الموارد البشرية للتحقق من مطابقتها للسياسات المعتمدة."],
    },
    health: {
      ranking: [
        "قارن الفروق بين الوحدات أو الحالات بعد ضبط حجم الحالات وخطورتها قبل الحكم على الأداء.",
      ],
      trend: [
        "تأكد من اكتمال التسجيل السريري في الفترات المقارنة، فالنقص قد يظهر كتحسّن أو تراجع وهمي.",
      ],
      anomaly: [
        "راجع القيم غير المعتادة مع الفريق السريري؛ بعضها قد يكون خطأ إدخال وبعضها حالة حقيقية.",
      ],
      default: ["تعامل مع النتيجة كمؤشر إحصائي لا كتشخيص، وراجعها مع المختصين."],
    },
    finance: {
      ranking: ["قارن العناصر الأعلى والأدنى بالميزانية المعتمدة لتحديد الانحراف المقبول."],
      trend: ["اربط الاتجاه بالموسمية والالتزامات الدورية قبل اعتباره تغيّراً هيكلياً."],
      anomaly: ["دقّق القيود غير المعتادة مستندياً قبل أي تسوية أو قرار."],
      default: ["قارن النتيجة بالتقارير المالية المعتمدة قبل اعتمادها في أي قرار."],
    },
  };

export function domainTail(
  domain: PlaybookId | undefined,
  intent: DomainIntent,
  key: string,
): string | null {
  if (!domain || domain === "generic") return null;
  const table = DOMAIN_TAILS[domain];
  if (!table) return null;
  const list = table[intent] ?? table.default;
  return list && list.length > 0 ? pickVariant(key, list, `tail:${domain}`) : null;
}

/** تحويل نوع intent إلى مفتاح مجال. */
export function domainIntent(intent: string): DomainIntent {
  return (["ranking", "compare", "trend", "distribution", "anomaly", "summary"] as const).includes(
    intent as never,
  )
    ? (intent as DomainIntent)
    : "default";
}
