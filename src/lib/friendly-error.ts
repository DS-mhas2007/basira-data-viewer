/**
 * يحوّل أخطاء المحرك (DuckDB) والشبكة وSupabase إلى رسائل عربية مفهومة.
 * الرسالة الأصلية تبقى في console لأغراض التصحيح، ولا تُعرض للمستخدم إلا إن كانت عربية أصلاً.
 */

const HAS_ARABIC = /[؀-ۿ]/;

interface Rule {
  test: RegExp;
  message: (m: RegExpExecArray) => string;
}

const RULES: Rule[] = [
  {
    test: /Referenced column "([^"]+)" not found/i,
    message: (m) => `العمود «${m[1]}» غير موجود في الجدول. تأكد من اسمه.`,
  },
  {
    test: /Table with name "?([^"\s]+)"? does not exist/i,
    message: (m) => `الجدول «${m[1]}» غير موجود.`,
  },
  {
    test: /Binder Error: .*No function matches/i,
    message: () => "نوع العمود لا يناسب هذه العملية (مثل حساب مجموع على نص). جرّب تحويل العمود أولاً.",
  },
  {
    test: /Conversion Error: .*(?:Could not convert|can't cast|cannot cast)/i,
    message: () => "تعذّر تحويل بعض القيم إلى النوع المطلوب. راجع القيم غير الصالحة في العمود.",
  },
  {
    test: /Out of Memory|out of memory/i,
    message: () => "الذاكرة لا تكفي لهذه العملية. جرّب ملفاً أصغر أو أغلق تبويبات أخرى.",
  },
  {
    test: /Parser Error|syntax error/i,
    message: () => "صياغة الاستعلام غير صحيحة. جرّب إعادة صياغة السؤال.",
  },
  {
    test: /Division by zero/i,
    message: () => "حدثت قسمة على صفر في أحد الصفوف.",
  },
  {
    test: /Invalid login credentials/i,
    message: () => "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  },
  {
    test: /User already registered|already been registered/i,
    message: () => "هذا البريد مسجّل مسبقاً. جرّب تسجيل الدخول.",
  },
  {
    test: /Email not confirmed/i,
    message: () => "لم يتم تأكيد بريدك بعد. افتح رسالة التأكيد في بريدك.",
  },
  {
    test: /Password should be at least|weak password/i,
    message: () => "كلمة المرور ضعيفة. استخدم ٦ خانات على الأقل.",
  },
  {
    test: /rate limit|too many requests|over_email_send_rate_limit/i,
    message: () => "محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.",
  },
  {
    test: /Failed to fetch|NetworkError|Load failed|network request failed/i,
    message: () => "تعذّر الاتصال بالشبكة. تأكد من الإنترنت وحاول مرة أخرى.",
  },
];

export function friendlyError(err: unknown, fallback = "حدث خطأ غير متوقع. حاول مرة أخرى."): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return fallback;
  for (const rule of RULES) {
    const m = rule.test.exec(raw);
    if (m) return rule.message(m);
  }
  // رسائلنا العربية الجاهزة تُعرض كما هي
  if (HAS_ARABIC.test(raw) && raw.length <= 300) return raw;
  if (typeof console !== "undefined") console.error("[basira] unhandled error:", err);
  return fallback;
}
