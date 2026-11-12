-- قراءة الحصة الحالية للمستخدم دون استهلاك (لعدّاد الواجهة). نفس منطق consume_ai_quota.
CREATE OR REPLACE FUNCTION public.get_ai_quota()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

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

  RETURN jsonb_build_object('plan', eff_plan, 'period', lim.period, 'limit', lim.max_requests, 'used', used,
    'remaining', GREATEST(lim.max_requests - used, 0), 'is_anonymous', anon);
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_quota() TO authenticated, service_role;
