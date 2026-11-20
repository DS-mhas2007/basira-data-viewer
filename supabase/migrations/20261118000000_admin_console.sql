-- لوحة تحكم المالك: تتبع الزيارات والحسابات ومنح الاشتراكات.
-- كل الجداول مغلقة أمام anon/authenticated. الوصول عبر دوال SECURITY DEFINER تتحقق من is_admin()،
-- والكتابة في site_visits عبر service_role من المسار /api/track فقط.

-- 1) انتهاء الاشتراك + من منحه
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- الخطة الفعلية: تُتجاهل الخطة المنتهية فيعود المستخدم إلى free.
CREATE OR REPLACE FUNCTION public.effective_plan(_uid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT up.plan FROM public.user_plans up
      WHERE up.user_id = _uid AND (up.expires_at IS NULL OR up.expires_at > now())),
    'free');
$$;
REVOKE ALL ON FUNCTION public.effective_plan(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_plan(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ai_quota()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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
    eff_plan := public.effective_plan(uid);
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

CREATE OR REPLACE FUNCTION public.consume_ai_quota(_action_id UUID DEFAULT NULL, _kind TEXT DEFAULT 'ai')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

  PERFORM pg_advisory_xact_lock(hashtextextended(uid::TEXT, 0));

  IF anon THEN
    eff_plan := 'anonymous';
  ELSE
    eff_plan := public.effective_plan(uid);
  END IF;

  SELECT * INTO lim FROM public.plan_limits WHERE plan = eff_plan;
  IF NOT FOUND THEN
    SELECT * INTO lim FROM public.plan_limits WHERE plan = 'free';
  END IF;

  since := CASE WHEN lim.period = 'month' THEN date_trunc('month', now()) ELSE '-infinity'::TIMESTAMPTZ END;
  SELECT COUNT(*) INTO used FROM public.ai_usage WHERE user_id = uid AND created_at >= since;

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

-- 2) الجداول (مغلقة تماماً أمام العملاء)
CREATE TABLE IF NOT EXISTS public.app_admins (
  email TEXT PRIMARY KEY CHECK (email = lower(email)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL DEFAULT 'view' CHECK (kind IN ('view', 'ping')),
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  device TEXT,
  browser TEXT,
  os TEXT
);
ALTER TABLE public.site_visits DROP COLUMN IF EXISTS ip_hash;
CREATE INDEX IF NOT EXISTS site_visits_time_idx ON public.site_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_user_idx ON public.site_visits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_visitor_idx ON public.site_visits (visitor_id);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user UUID REFERENCES auth.users ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admins, public.site_visits, public.admin_audit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_admins, public.site_visits, public.admin_audit_log TO service_role;

-- 3) هل المستخدم الحالي هو المالك؟ يشترط بريداً مسجلاً في app_admins وهوية Google موثّقة.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.app_admins a ON a.email = lower(u.email)
    WHERE u.id = auth.uid()
      AND COALESCE(u.is_anonymous, false) = false
      AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'google')
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 4) نظرة عامة
CREATE OR REPLACE FUNCTION public.admin_overview(_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  d INT := LEAST(GREATEST(COALESCE(_days, 30), 1), 365);
  v_since TIMESTAMPTZ := date_trunc('day', now()) - make_interval(days => LEAST(GREATEST(COALESCE(_days, 30), 1), 365) - 1);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'days', d,
    'kpis', jsonb_build_object(
      'live_now', (SELECT COUNT(DISTINCT session_id) FROM public.site_visits WHERE created_at > now() - interval '5 minutes'),
      'visits_today', (SELECT COUNT(*) FROM public.site_visits WHERE kind = 'view' AND created_at >= date_trunc('day', now())),
      'visits', (SELECT COUNT(*) FROM public.site_visits WHERE kind = 'view' AND created_at >= v_since),
      'visitors', (SELECT COUNT(DISTINCT visitor_id) FROM public.site_visits WHERE kind = 'view' AND created_at >= v_since),
      'accounts', (SELECT COUNT(*) FROM auth.users WHERE NOT COALESCE(is_anonymous, false)),
      'guests', (SELECT COUNT(*) FROM auth.users WHERE COALESCE(is_anonymous, false)),
      'gmail', (SELECT COUNT(*) FROM auth.users WHERE NOT COALESCE(is_anonymous, false) AND lower(email) LIKE '%@gmail.com'),
      'new_accounts', (SELECT COUNT(*) FROM auth.users WHERE NOT COALESCE(is_anonymous, false) AND created_at >= v_since),
      'ai_requests', (SELECT COUNT(*) FROM public.ai_usage WHERE created_at >= v_since),
      'paid', (SELECT COUNT(*) FROM public.user_plans WHERE plan <> 'free' AND (expires_at IS NULL OR expires_at > now()))
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.day)
      FROM (
        SELECT g.day::date AS day,
               COALESCE(v.visits, 0) AS visits,
               COALESCE(v.visitors, 0) AS visitors,
               COALESCE(s.signups, 0) AS signups
        FROM generate_series(v_since, date_trunc('day', now()), interval '1 day') AS g(day)
        LEFT JOIN (
          SELECT created_at::date AS day, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors
          FROM public.site_visits WHERE kind = 'view' AND created_at >= v_since GROUP BY 1
        ) v ON v.day = g.day::date
        LEFT JOIN (
          SELECT created_at::date AS day, COUNT(*) AS signups
          FROM auth.users WHERE NOT COALESCE(is_anonymous, false) AND created_at >= v_since GROUP BY 1
        ) s ON s.day = g.day::date
      ) t), '[]'::jsonb),
    'countries', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.visits DESC)
      FROM (SELECT country, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors
            FROM public.site_visits WHERE kind = 'view' AND created_at >= v_since
            GROUP BY country ORDER BY visits DESC LIMIT 10) t), '[]'::jsonb),
    'cities', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.visits DESC)
      FROM (SELECT country, city, COUNT(*) AS visits
            FROM public.site_visits WHERE kind = 'view' AND created_at >= v_since AND city IS NOT NULL
            GROUP BY country, city ORDER BY visits DESC LIMIT 8) t), '[]'::jsonb),
    'pages', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.visits DESC)
      FROM (SELECT path, COUNT(*) AS visits
            FROM public.site_visits WHERE kind = 'view' AND created_at >= v_since
            GROUP BY path ORDER BY visits DESC LIMIT 8) t), '[]'::jsonb),
    'devices', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.visits DESC)
      FROM (SELECT COALESCE(device, 'unknown') AS device, COUNT(*) AS visits
            FROM public.site_visits WHERE kind = 'view' AND created_at >= v_since
            GROUP BY 1 ORDER BY visits DESC) t), '[]'::jsonb),
    'referrers', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.visits DESC)
      FROM (SELECT COALESCE(NULLIF(referrer, ''), 'مباشر') AS referrer, COUNT(*) AS visits
            FROM public.site_visits WHERE kind = 'view' AND created_at >= v_since
            GROUP BY 1 ORDER BY visits DESC LIMIT 6) t), '[]'::jsonb),
    'plans', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.n DESC)
      FROM (SELECT CASE WHEN up.user_id IS NOT NULL AND (up.expires_at IS NULL OR up.expires_at > now()) THEN up.plan ELSE 'free' END AS plan,
                   COUNT(*) AS n
            FROM auth.users u LEFT JOIN public.user_plans up ON up.user_id = u.id
            WHERE NOT COALESCE(u.is_anonymous, false)
            GROUP BY 1) t), '[]'::jsonb)
  );
END;
$$;

-- 5) سجل الزيارات
CREATE OR REPLACE FUNCTION public.admin_recent_visits(_limit INT DEFAULT 40, _offset INT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC, t.id DESC)
    FROM (
      SELECT v.id, v.created_at, v.path, v.referrer, v.country, v.region, v.city,
             v.device, v.browser, v.os, u.email, COALESCE(u.is_anonymous, false) AS is_guest
      FROM public.site_visits v
      LEFT JOIN auth.users u ON u.id = v.user_id
      WHERE v.kind = 'view'
      ORDER BY v.created_at DESC, v.id DESC
      LIMIT LEAST(GREATEST(COALESCE(_limit, 40), 1), 200)
      OFFSET GREATEST(COALESCE(_offset, 0), 0)
    ) t), '[]'::jsonb);
END;
$$;

-- 6) الحسابات
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search TEXT DEFAULT NULL, _filter TEXT DEFAULT 'all', _limit INT DEFAULT 25, _offset INT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH f AS (
      SELECT
        u.id,
        u.email,
        COALESCE(u.is_anonymous, false) AS is_guest,
        COALESCE(u.raw_app_meta_data ->> 'provider', 'email') AS provider,
        u.created_at,
        u.last_sign_in_at,
        CASE WHEN COALESCE(u.is_anonymous, false) THEN 'anonymous'
             WHEN up.user_id IS NOT NULL AND (up.expires_at IS NULL OR up.expires_at > now()) THEN up.plan
             ELSE 'free' END AS plan,
        up.expires_at,
        (SELECT COUNT(*) FROM public.ai_usage a WHERE a.user_id = u.id AND a.created_at >= date_trunc('month', now())) AS ai_month,
        (SELECT COUNT(*) FROM public.site_visits sv WHERE sv.user_id = u.id AND sv.kind = 'view') AS visits,
        lv.country,
        lv.city,
        lv.created_at AS last_seen,
        COALESCE(u.last_sign_in_at, u.created_at) AS sort_at
      FROM auth.users u
      LEFT JOIN public.user_plans up ON up.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT s.country, s.city, s.created_at
        FROM public.site_visits s WHERE s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1
      ) lv ON true
      WHERE (COALESCE(_search, '') = '' OR u.email ILIKE '%' || _search || '%')
        AND CASE COALESCE(_filter, 'all')
              WHEN 'guests' THEN COALESCE(u.is_anonymous, false)
              WHEN 'gmail' THEN NOT COALESCE(u.is_anonymous, false) AND lower(u.email) LIKE '%@gmail.com'
              WHEN 'paid' THEN NOT COALESCE(u.is_anonymous, false) AND up.user_id IS NOT NULL
                               AND up.plan <> 'free' AND (up.expires_at IS NULL OR up.expires_at > now())
              ELSE NOT COALESCE(u.is_anonymous, false)
            END
    )
    SELECT jsonb_build_object(
      'total', (SELECT COUNT(*) FROM f),
      'rows', COALESCE((
        SELECT jsonb_agg(to_jsonb(p) ORDER BY p.sort_at DESC)
        FROM (SELECT * FROM f ORDER BY sort_at DESC
              LIMIT LEAST(GREATEST(COALESCE(_limit, 25), 1), 100)
              OFFSET GREATEST(COALESCE(_offset, 0), 0)) p), '[]'::jsonb)
    )
  );
END;
$$;

-- 7) منح/إلغاء الاشتراك (free = إلغاء). _days فارغ = دائم.
CREATE OR REPLACE FUNCTION public.admin_set_plan(
  _user_id UUID, _plan TEXT, _days INT DEFAULT NULL, _note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_exp TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND NOT COALESCE(is_anonymous, false)) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF _plan = 'free' THEN
    DELETE FROM public.user_plans WHERE user_id = _user_id;
  ELSE
    IF _days IS NOT NULL AND (_days < 1 OR _days > 3650) THEN
      RAISE EXCEPTION 'invalid_duration';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.plan_limits WHERE plan = _plan AND plan <> 'anonymous') THEN
      RAISE EXCEPTION 'invalid_plan';
    END IF;
    v_exp := CASE WHEN _days IS NULL THEN NULL
                  ELSE now() + make_interval(days => _days) END;
    INSERT INTO public.user_plans (user_id, plan, updated_at, expires_at, granted_by, note)
    VALUES (_user_id, _plan, now(), v_exp, auth.uid(), NULLIF(left(_note, 300), ''))
    ON CONFLICT (user_id) DO UPDATE
      SET plan = EXCLUDED.plan, updated_at = now(), expires_at = EXCLUDED.expires_at,
          granted_by = EXCLUDED.granted_by, note = EXCLUDED.note;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user, details)
  VALUES (auth.uid(), 'set_plan', _user_id,
          jsonb_build_object('plan', _plan, 'days', _days, 'expires_at', v_exp, 'note', NULLIF(left(_note, 300), '')));

  RETURN jsonb_build_object('ok', true, 'plan', _plan, 'expires_at', v_exp);
END;
$$;

-- 8) الاشتراكات الفعّالة وسجل التدقيق
CREATE OR REPLACE FUNCTION public.admin_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'active', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC)
      FROM (
        SELECT up.user_id, u.email, up.plan, up.expires_at, up.updated_at, up.note, g.email AS granted_by_email
        FROM public.user_plans up
        JOIN auth.users u ON u.id = up.user_id
        LEFT JOIN auth.users g ON g.id = up.granted_by
        WHERE up.plan <> 'free' AND (up.expires_at IS NULL OR up.expires_at > now())
      ) t), '[]'::jsonb),
    'audit', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
      FROM (
        SELECT l.created_at, l.action, l.details, ad.email AS admin_email, tu.email AS target_email
        FROM public.admin_audit_log l
        LEFT JOIN auth.users ad ON ad.id = l.admin_id
        LEFT JOIN auth.users tu ON tu.id = l.target_user
        ORDER BY l.created_at DESC
        LIMIT 40
      ) a), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_overview(INT), public.admin_recent_visits(INT, INT),
  public.admin_list_users(TEXT, TEXT, INT, INT), public.admin_set_plan(UUID, TEXT, INT, TEXT),
  public.admin_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview(INT), public.admin_recent_visits(INT, INT),
  public.admin_list_users(TEXT, TEXT, INT, INT), public.admin_set_plan(UUID, TEXT, INT, TEXT),
  public.admin_subscriptions() TO authenticated;

-- بعد تطبيق هذا الملف، سجّل بريدك كمالك (مرة واحدة، من محرر SQL):
--   INSERT INTO public.app_admins (email) VALUES (lower('your-gmail@gmail.com'));
