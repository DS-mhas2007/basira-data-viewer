# حزمة evals العربية

- `sales.csv`: بيانات مرجعية (120 صفاً). `cases.json`: 17 سؤالاً عربياً، لكل منها SQL مرجعي والإجابة المتوقعة محسوبة مستقلاً بـ pandas.
- تشغيل الجزء المرجعي (بلا مفتاح، يعمل في CI): `npx vitest run src/evals`
- تشغيل الجزء الحي على نموذج حقيقي (المفتاح يبقى في بيئتك المحلية فقط):
  `EVAL_API_KEY=... EVAL_MODEL=llama-3.3-70b-versatile npx vitest run src/evals`
  (`EVAL_API_URL` لأي واجهة متوافقة مع OpenAI، و`EVAL_MIN_PASS` الحد الأدنى للنجاح، الافتراضي 0.8)
- أضف سؤالاً جديداً: أضفه إلى `cases.json` مع gold والرقم المتوقع من حساب مستقل، لا من نفس SQL.
