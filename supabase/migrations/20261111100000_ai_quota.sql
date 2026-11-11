-- حدود استخدام الذكاء الاصطناعي: تجربة للزائر (تسجيل دخول مجهول) ثم خطة مجانية ثم خطط مدفوعة.
-- كل التحقق والعدّ يتم داخل دالة واحدة ذرية (consume_ai_quota) تُستدعى من السيرفر بصلاحية المستخدم.

-- 1) حدود كل خطة. تعديل الأرقام = UPDATE على هذا الجدول بدون نشر كود.
--    'anonymous' خطة افتراضية للزوار (مستخدم Supabase المجهول)، لا تُخزَّن في user_plans.
--    أرقام pro/team مؤقتة وتُعدَّل عند تحديد الأسعار.
CREATE TABLE public.plan_limits (
  plan TEXT PRIMARY KEY,
  period TEXT NOT NULL CHECK (period IN ('lifetime', 'month')),
  max_requests INTEGER NOT NULL CHECK (max_requests >= 0)
);

INSERT INTO public.plan_limits (plan, period, max_requests) VALUES
  ('anonymous', 'lifetime', 5),
  ('free',      'month',    30),
  ('pro',       'month',    1000),
  ('team',      'month',    5000);

-- 2) خطة كل مستخدم. الغياب = free. يكتبها السيرفر فقط (webhook الدفع لاحقاً).
CREATE TABLE public.user_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' REFERENCES public.plan_limits (plan) CHECK (plan <> 'anonymous'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) سجل الاستخدام. action_id يجمع عدة استدعاءات لنفس العملية (مثل تشغيل الوكيل: عدة أسئلة + ملخص)
--    في طلب واحد محسوب.
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  action_id UUID,
  kind TEXT NOT NULL DEFAULT 'ai',
  calls INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_usage_action_idx ON public.ai_usage (user_id, action_id) WHERE action_id IS NOT NULL;
CREATE INDEX ai_usage_user_time_idx ON public.ai_usage (user_id, created_at);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- قراءة فقط للمستخدم. لا سياسات كتابة: الكتابة عبر الدالة (SECURITY DEFINER) أو service_role.
CREATE POLICY "read limits" ON public.plan_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY "read own plan" ON public.user_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "read own usage" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON public.plan_limits, public.user_plans, public.ai_usage TO authenticated;
GRANT ALL ON public.plan_limits, public.user_plans, public.ai_usage TO service_role;

-- 4) الدالة الذرية. تعيد jsonb: allowed, plan, period, limit, used, remaining, is_anonymous, reason.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(_action_id UUID DEFAULT NULL, _kind TEXT DEFAULT 'ai')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid UUID := auth.uid();
  anon BOOLEAN := COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, false);
  eff_plan TEXT;
  lim public.plan_limits%ROWTYPE;
  since TIMESTAMPTZ;
  used INTEGER;
  existing public.ai_usage%ROWTYPE;
  max_calls_per_action CONSTANT INTEGER := 30;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- يمنع سباق طلبين متزامنين لنفس المستخدم من تجاوز الحد
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::TEXT, 0));

  IF anon THEN
    eff_plan := 'anonymous';
  ELSE
    SELECT COALESCE((SELECT up.plan FROM public.user_plans up WHERE up.user_id = uid), 'free') INTO eff_plan;
  END IF;

  SELECT * INTO lim FROM public.plan_limits WHERE plan = eff_plan;
  IF NOT FOUND THEN
    SELECT * INTO lim FROM public.plan_limits WHERE plan = 'free';
  END IF;

  since := CASE WHEN lim.period = 'month' THEN date_trunc('month', now()) ELSE '-infinity'::TIMESTAMPTZ END;
  SELECT COUNT(*) INTO used FROM public.ai_usage WHERE user_id = uid AND created_at >= since;

  -- استدعاء إضافي ضمن عملية محسوبة سابقاً: بلا خصم جديد (بسقف أمان)
  IF _action_id IS NOT NULL THEN
    SELECT * INTO existing FROM public.ai_usage WHERE user_id = uid AND action_id = _action_id;
    IF FOUND THEN
      IF existing.calls >= max_calls_per_action THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'action_limit', 'plan', eff_plan, 'period', lim.period,
          'limit', lim.max_requests, 'used', used, 'remaining', GREATEST(lim.max_requests - used, 0), 'is_anonymous', anon);
      END IF;
      UPDATE public.ai_usage SET calls = calls + 1 WHERE id = existing.id;
      RETURN jsonb_build_object('allowed', true, 'reason', 'ok', 'plan', eff_plan, 'period', lim.period,
        'limit', lim.max_requests, 'used', used, 'remaining', GREATEST(lim.max_requests - used, 0), 'is_anonymous', anon);
    END IF;
  END IF;

  IF used >= lim.max_requests THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'plan', eff_plan, 'period', lim.period,
      'limit', lim.max_requests, 'used', used, 'remaining', 0, 'is_anonymous', anon);
  END IF;

  INSERT INTO public.ai_usage (user_id, action_id, kind) VALUES (uid, _action_id, COALESCE(NULLIF(_kind, ''), 'ai'));
  used := used + 1;
  RETURN jsonb_build_object('allowed', true, 'reason', 'ok', 'plan', eff_plan, 'period', lim.period,
    'limit', lim.max_requests, 'used', used, 'remaining', GREATEST(lim.max_requests - used, 0), 'is_anonymous', anon);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, TEXT) TO authenticated, service_role;
