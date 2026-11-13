# بصيرة (Basira)

منصة عربية (RTL) لتحليل ملفات CSV وXLSX داخل المتصفح: فحص جودة البيانات، تنظيفها، رسوم بيانية، تقارير PDF، وسؤال البيانات بالعربية بمساعدة الذكاء الاصطناعي.

## ما الذي يعمل محلياً وما الذي يُرسل؟

- **محلياً بالكامل:** قراءة الملف، الفحص، التنظيف، الاستعلامات والرسوم. تُنفَّذ عبر DuckDB-WASM داخل المتصفح، والملف الأصلي لا يُرفع.
- **ميزات الذكاء الاصطناعي:** تُرسل إلى مزوّد النموذج سؤالك وأسماء الأعمدة وأنواعها وعيّنة صغيرة (حتى 10 صفوف)، وفي محادثة «اسأل بصيرة» نتائج الاستعلامات التي ينفّذها الوكيل. تُحفظ المحادثة في حساب المستخدم ما لم يفعّل «لا تحفظ محادثتي».

## التقنيات

- TanStack Start (React 19, Vite 8) وTailwind 4 وshadcn/ui
- DuckDB-WASM لتنفيذ SQL في المتصفح (يُحمَّل من jsDelivr بسبب حد 25MB لملفات Cloudflare)
- Supabase للمصادقة (يشمل الدخول كزائر) وقاعدة البيانات
- Vercel AI SDK مع OpenRouter
- PWA عبر vite-plugin-pwa (يعمل دون اتصال بعد الزيارة الأولى)
- Vitest للاختبارات، وCI عبر GitHub Actions وbun

## التشغيل محلياً

```bash
bun install        # أو: npm install --legacy-peer-deps
cp .env.example .env   # واملأ القيم
bun run dev
```

أوامر مفيدة: `bunx tsc --noEmit` و`bunx vitest run` و`bunx vite build`. اختبار المتصفح الدخاني: راجع التعليق أعلى `e2e/smoke.mjs`. ملف القفل المعتمد هو `bun.lock`.

## الإعداد على Supabase

1. طبّق ملفات `supabase/migrations/` بالترتيب.
2. فعّل **Anonymous sign-ins** (Authentication → Providers). مطلوب للتجربة كزائر.
3. متغيرات الخادم: `LOVABLE_API_KEY` لمحادثة «اسأل بصيرة»، و`OPENROUTER_API_KEY` لبقية ميزات الذكاء الاصطناعي، و`SUPABASE_SERVICE_ROLE_KEY`. القائمة الكاملة في `.env.example`.
4. اختبار نظام الحصص: `npm i --no-save @electric-sql/pglite && node supabase/tests/ai_quota.mjs`.

## الحصص

حدود الاستخدام في جدول `plan_limits`: زائر 5 طلبات مدى الحياة، وحساب مجاني 30 طلباً شهرياً. خطط `pro` و`team` أرقامها مؤقتة ولا يوجد دفع بعد. يُحسب كل سؤال مرة واحدة حتى لو استدعى النموذج أدوات عدة (`action_id`).

## ملاحظات للمساهمين

المشروع مربوط بـ Lovable: لا تستخدم force push ولا rebase ولا amend لعمل منشور، وأبقِ `main` صالحاً للتشغيل. راجع `AGENTS.md`.
