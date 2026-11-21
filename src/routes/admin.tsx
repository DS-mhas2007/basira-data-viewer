import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import type { EChartsOption } from "echarts";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  Brain,
  Crown,
  Eye,
  Globe,
  LayoutDashboard,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
  UserPlus,
  Users,
  Zap,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { AuthActions } from "@/components/AuthActions";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EChartsView } from "@/components/EChartsView";
import { relativeTime } from "@/lib/workspace-store";
import {
  adminRpc,
  useIsAdmin,
  type AdminOverview,
  type Subscriptions,
  type UserRow,
  type UsersPage,
  type VisitRow,
} from "@/lib/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "لوحة التحكم — MIZYAi" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

/* ───────── أدوات عرض ───────── */

const nf = (n: number) => n.toLocaleString("en-US");
const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-GB");
const ago = (iso: string | null) => (iso ? relativeTime(Date.parse(iso)) : "—");

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["ar"], { type: "region" })
    : null;

function flag(cc: string | null | undefined): string {
  if (!cc || cc.length !== 2) return "🌐";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

function countryName(cc: string | null | undefined): string {
  if (!cc) return "غير معروف";
  try {
    return regionNames?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

function place(country: string | null, city: string | null): string {
  if (!country && !city) return "غير معروف";
  return `${flag(country)} ${city ? `${city}، ` : ""}${countryName(country)}`;
}

const PLAN_LABEL: Record<string, string> = {
  anonymous: "زائر",
  free: "مجاني",
  pro: "Pro",
  team: "Team",
};
const PLAN_STYLE: Record<string, string> = {
  pro: "bg-accent/15 text-accent",
  team: "bg-primary/10 text-primary",
  free: "bg-muted text-muted-foreground",
  anonymous: "bg-muted text-muted-foreground",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PLAN_STYLE[plan] ?? PLAN_STYLE["free"]}`}
    >
      {PLAN_LABEL[plan] ?? plan}
    </span>
  );
}

function DeviceIcon({ device }: { device: string | null }) {
  const cls = "size-3.5 shrink-0 text-muted-foreground";
  if (device === "mobile") return <Smartphone className={cls} />;
  if (device === "tablet") return <Tablet className={cls} />;
  return <Monitor className={cls} />;
}

/* ───────── مكوّنات الواجهة ───────── */

const PANEL =
  "rounded-[18px_8px_18px_8px] border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm";

function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${PANEL} p-4 sm:p-5 ${className}`}>
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  live = false,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  live?: boolean;
}) {
  return (
    <div className={`${PANEL} flex items-start gap-3 p-4`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px_5px_12px_5px] bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {live && <span className="pulse-dot" aria-hidden="true" />}
          {label}
        </p>
        <p className="mt-0.5 font-mono text-2xl font-bold leading-none text-foreground">
          {typeof value === "number" ? nf(value) : value}
        </p>
        {sub && <p className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function BarList({
  rows,
  empty = "لا بيانات بعد",
}: {
  rows: { label: ReactNode; value: number }[];
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="font-mono text-muted-foreground">{nf(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="جارٍ التحميل">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/70" />
      ))}
    </div>
  );
}

function ErrorNote({ error }: { error: unknown }) {
  return (
    <p
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
      role="alert"
    >
      تعذّر جلب البيانات: {error instanceof Error ? error.message : "خطأ غير معروف"}. تأكد من تطبيق
      الـ migration وتسجيل بريدك في app_admins.
    </p>
  );
}

function TableShell({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-start text-xs" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

const TH = "px-3 py-2 text-start text-[11px] font-semibold text-muted-foreground bg-muted/40";
const TD = "px-3 py-2.5 align-middle border-t border-border/50";

/* ───────── الصفحة ───────── */

function AdminPage() {
  const { data: isAdmin, isLoading, isError, error, refetch } = useIsAdmin();
  const qc = useQueryClient();
  const [days, setDays] = useState("30");

  if (isLoading) {
    return (
      <main dir="rtl" className="mx-auto max-w-6xl p-6">
        <Loading />
      </main>
    );
  }

  if (isError) {
    return (
      <main
        dir="rtl"
        lang="ar"
        className="mx-auto flex min-h-screen max-w-xl items-center justify-center bg-background px-4"
      >
        <section
          className="w-full rounded-2xl border border-destructive/30 bg-card p-6 text-center"
          role="alert"
        >
          <h1 className="text-lg font-bold text-foreground">تعذّر التحقق من صلاحية الدخول</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            قد يكون السبب اتصالاً مؤقتاً أو مشكلة في جلسة الدخول. لم نعتبر ذلك رفضاً للصلاحية.
          </p>
          <p className="mt-2 break-words text-xs text-destructive">
            {error instanceof Error ? error.message : "خطأ غير معروف"}
          </p>
          <Button className="mt-4" onClick={() => void refetch()}>
            إعادة المحاولة
          </Button>
        </section>
      </main>
    );
  }

  // لا نكشف وجود الصفحة لغير المالك: نعرض نفس صفحة 404 العامة.
  if (!isAdmin) {
    return (
      <main
        dir="rtl"
        lang="ar"
        className="flex min-h-screen items-center justify-center bg-background px-4"
      >
        <div className="max-w-md text-center">
          <p className="font-mono text-7xl font-bold text-primary">404</p>
          <h1 className="mt-4 text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            العودة إلى MIZYAi
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-[16px_6px_16px_6px] bg-primary text-primary-foreground">
              <LayoutDashboard className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">لوحة تحكم المالك</h1>
              <p className="text-xs text-muted-foreground">
                الزيارات والحسابات والاشتراكات — تُحدَّث تلقائياً
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AuthActions />
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-9 w-[130px] text-xs" aria-label="الفترة الزمنية">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">آخر 7 أيام</SelectItem>
                <SelectItem value="30">آخر 30 يوماً</SelectItem>
                <SelectItem value="90">آخر 90 يوماً</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="تحديث البيانات"
              onClick={() =>
                void qc.invalidateQueries({
                  predicate: (q) => String(q.queryKey[0]).startsWith("admin-"),
                })
              }
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <Link to="/">
                <ArrowRight className="size-3.5" />
                المنصة
              </Link>
            </Button>
          </div>
        </header>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="overview" className="text-xs">
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="visits" className="text-xs">
              الزوار
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              الحسابات
            </TabsTrigger>
            <TabsTrigger value="subs" className="text-xs">
              الاشتراكات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab days={Number(days)} />
          </TabsContent>
          <TabsContent value="visits">
            <VisitsTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="subs">
            <SubsTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

/* ───────── نظرة عامة ───────── */

const AXIS = { color: "#78818A", fontSize: 11 };

function OverviewTab({ days }: { days: number }) {
  const q = useQuery({
    queryKey: ["admin-overview", days],
    queryFn: () => adminRpc<AdminOverview>("admin_overview", { _days: days }),
    refetchInterval: 60_000,
  });
  const o = q.data;

  const dailyOption = useMemo<EChartsOption>(
    () => ({
      color: ["#287F74", "#735C9A"],
      grid: { left: 6, right: 10, top: 34, bottom: 4, containLabel: true },
      tooltip: { trigger: "axis" },
      legend: { top: 0, textStyle: AXIS, data: ["الزيارات", "الزوار الفريدون"] },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: (o?.daily ?? []).map((d) => d.day.slice(5)),
        axisLabel: AXIS,
        axisLine: { lineStyle: { color: "#E7E3DA" } },
      },
      yAxis: { type: "value", axisLabel: AXIS, splitLine: { lineStyle: { color: "#EFEBE1" } } },
      series: [
        {
          name: "الزيارات",
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: { opacity: 0.12 },
          data: (o?.daily ?? []).map((d) => d.visits),
        },
        {
          name: "الزوار الفريدون",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: (o?.daily ?? []).map((d) => d.visitors),
        },
      ],
    }),
    [o],
  );

  const deviceOption = useMemo<EChartsOption>(
    () => ({
      color: ["#287F74", "#735C9A", "#C9A24B", "#B86B6B"],
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["52%", "78%"],
          label: { show: false },
          data: (o?.devices ?? []).map((d) => ({
            name:
              d.device === "mobile"
                ? "جوال"
                : d.device === "tablet"
                  ? "لوحي"
                  : d.device === "desktop"
                    ? "حاسوب"
                    : "غير معروف",
            value: d.visits,
          })),
        },
      ],
    }),
    [o],
  );

  if (q.isError) return <ErrorNote error={q.error} />;
  if (!o) return <Loading rows={4} />;
  const k = o.kpis;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          live
          icon={<Activity className="size-4" />}
          label="متصلون الآن"
          value={k.live_now}
          sub="آخر 5 دقائق"
        />
        <Kpi icon={<Eye className="size-4" />} label="زيارات اليوم" value={k.visits_today} />
        <Kpi
          icon={<Globe className="size-4" />}
          label={`زيارات ${o.days} يوماً`}
          value={k.visits}
          sub={`${nf(k.visitors)} زائر فريد`}
        />
        <Kpi
          icon={<Users className="size-4" />}
          label="الحسابات"
          value={k.accounts}
          sub={`${nf(k.gmail)} Gmail · ${nf(k.guests)} زائر مجهول`}
        />
        <Kpi
          icon={<UserPlus className="size-4" />}
          label="تسجيلات جديدة"
          value={k.new_accounts}
          sub={`خلال ${o.days} يوماً`}
        />
        <Kpi
          icon={<Brain className="size-4" />}
          label="طلبات الذكاء الاصطناعي"
          value={k.ai_requests}
          sub={`خلال ${o.days} يوماً`}
        />
        <Kpi icon={<Crown className="size-4" />} label="اشتراكات فعّالة" value={k.paid} />
        <Kpi
          icon={<Zap className="size-4" />}
          label="متوسط الزيارات اليومي"
          value={nf(Math.round(k.visits / Math.max(o.days, 1)))}
        />
      </div>

      <Panel title="الزيارات والزوار" hint="يومياً">
        <EChartsView option={dailyOption} className="h-64 w-full" label="الزيارات اليومية" />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="الدول">
          <BarList
            rows={o.countries.map((c) => ({
              label: `${flag(c.country)} ${countryName(c.country)}`,
              value: c.visits,
            }))}
          />
        </Panel>
        <Panel title="المدن">
          <BarList
            empty="المدن تظهر عند تفعيل ترويسات الموقع في الاستضافة"
            rows={o.cities.map((c) => ({ label: place(c.country, c.city), value: c.visits }))}
          />
        </Panel>
        <Panel title="الأجهزة">
          <EChartsView
            option={deviceOption}
            className="h-44 w-full"
            label="توزيع الأجهزة"
            glassBare
          />
        </Panel>
        <Panel title="أكثر الصفحات">
          <BarList
            rows={o.pages.map((p) => ({ label: <span dir="ltr">{p.path}</span>, value: p.visits }))}
          />
        </Panel>
        <Panel title="مصادر الزيارة">
          <BarList
            rows={o.referrers.map((r) => ({
              label: <span dir="auto">{r.referrer}</span>,
              value: r.visits,
            }))}
          />
        </Panel>
        <Panel title="الحسابات حسب الخطة">
          <BarList
            rows={o.plans.map((p) => ({ label: PLAN_LABEL[p.plan] ?? p.plan, value: p.n }))}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ───────── الزوار ───────── */

const VISITS_PAGE = 40;

function VisitsTab() {
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["admin-visits", page],
    queryFn: () =>
      adminRpc<VisitRow[]>("admin_recent_visits", {
        _limit: VISITS_PAGE,
        _offset: page * VISITS_PAGE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  if (q.isError) return <ErrorNote error={q.error} />;
  if (!q.data) return <Loading rows={5} />;
  const rows = q.data;

  return (
    <Panel title="سجل الزيارات" hint="الأحدث أولاً">
      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">لا زيارات مسجّلة بعد.</p>
      ) : (
        <TableShell minWidth={760}>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                الوقت
              </th>
              <th scope="col" className={TH}>
                الزائر
              </th>
              <th scope="col" className={TH}>
                الصفحة
              </th>
              <th scope="col" className={TH}>
                الموقع
              </th>
              <th scope="col" className={TH}>
                الجهاز
              </th>
              <th scope="col" className={TH}>
                المصدر
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                  {ago(v.created_at)}
                </td>
                <td className={TD}>
                  {v.email ? (
                    <span dir="ltr" className="font-medium">
                      {v.email}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {v.is_guest ? "زائر مجهول" : "غير مسجّل"}
                    </span>
                  )}
                </td>
                <td className={TD}>
                  <span dir="ltr" className="font-mono">
                    {v.path}
                  </span>
                </td>
                <td className={`${TD} whitespace-nowrap`}>{place(v.country, v.city)}</td>
                <td className={TD}>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <DeviceIcon device={v.device} />
                    {[v.browser, v.os].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className={`${TD} text-muted-foreground`}>{v.referrer ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      <Pager page={page} setPage={setPage} hasNext={rows.length === VISITS_PAGE} />
    </Panel>
  );
}

function Pager({
  page,
  setPage,
  hasNext,
}: {
  page: number;
  setPage: (n: number) => void;
  hasNext: boolean;
}) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
        السابق
      </Button>
      <span className="font-mono text-muted-foreground">{page + 1}</span>
      <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setPage(page + 1)}>
        التالي
      </Button>
    </div>
  );
}

/* ───────── الحسابات ───────── */

const USERS_PAGE = 25;
const FILTERS = [
  { id: "all", label: "الكل" },
  { id: "gmail", label: "Gmail" },
  { id: "paid", label: "مدفوع" },
  { id: "guests", label: "زوار مجهولون" },
] as const;

function UsersTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<UserRow | null>(null);
  const deferred = useDeferredValue(search.trim());

  const q = useQuery({
    queryKey: ["admin-users", deferred, filter, page],
    queryFn: () =>
      adminRpc<UsersPage>("admin_list_users", {
        _search: deferred || null,
        _filter: filter,
        _limit: USERS_PAGE,
        _offset: page * USERS_PAGE,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <Panel title="الحسابات" hint={q.data ? `${nf(q.data.total)} نتيجة` : undefined}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="ابحث بالبريد الإلكتروني"
            dir="ltr"
            className="h-9 ps-9 text-xs"
            aria-label="بحث في الحسابات"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setPage(0);
              }}
              aria-pressed={filter === f.id}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                filter === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {q.isError ? (
        <ErrorNote error={q.error} />
      ) : !q.data ? (
        <Loading rows={5} />
      ) : q.data.rows.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-muted-foreground">لا حسابات مطابقة.</p>
          {(search || filter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setSearch("");
                setFilter("all");
                setPage(0);
              }}
            >
              مسح البحث والفلاتر
            </Button>
          )}
        </div>
      ) : (
        <TableShell minWidth={820}>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                الحساب
              </th>
              <th scope="col" className={TH}>
                الدخول
              </th>
              <th scope="col" className={TH}>
                الخطة
              </th>
              <th scope="col" className={TH}>
                AI هذا الشهر
              </th>
              <th scope="col" className={TH}>
                آخر موقع
              </th>
              <th scope="col" className={TH}>
                آخر دخول
              </th>
              <th scope="col" className={TH}></th>
            </tr>
          </thead>
          <tbody>
            {q.data.rows.map((u) => (
              <tr key={u.id}>
                <td className={TD}>
                  <span dir="ltr" className="block font-medium">
                    {u.email ?? "زائر مجهول"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    انضم {dateOf(u.created_at)}
                  </span>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {u.is_guest ? "مجهول" : u.provider === "google" ? "Google" : "بريد وكلمة مرور"}
                </td>
                <td className={TD}>
                  <PlanBadge plan={u.plan} />
                  {u.expires_at && (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      حتى {dateOf(u.expires_at)}
                    </span>
                  )}
                </td>
                <td className={`${TD} font-mono`}>{nf(u.ai_month)}</td>
                <td className={`${TD} whitespace-nowrap`}>{place(u.country, u.city)}</td>
                <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                  {ago(u.last_sign_in_at)}
                </td>
                <td className={TD}>
                  {!u.is_guest && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => setTarget(u)}
                    >
                      <Crown className="size-3" />
                      اشتراك
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      <Pager page={page} setPage={setPage} hasNext={(q.data?.rows.length ?? 0) === USERS_PAGE} />
      <GrantDialog user={target} onClose={() => setTarget(null)} />
    </Panel>
  );
}

/* ───────── منح الاشتراك ───────── */

function GrantDialog({
  user,
  onClose,
}: {
  user: { id: string; email: string | null; plan: string } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState(
    user?.plan === "team" || user?.plan === "pro" ? user.plan : "pro",
  );
  const [dur, setDur] = useState("30");
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const userId = user?.id;
  const userPlan = user?.plan;

  useEffect(() => {
    if (!userId || !userPlan) return;
    setPlan(userPlan === "team" || userPlan === "pro" ? userPlan : "pro");
    setDur("30");
    setNote("");
    setConfirmCancel(false);
  }, [userId, userPlan]);

  const save = useMutation({
    mutationFn: () =>
      adminRpc<{ ok: boolean }>("admin_set_plan", {
        _user_id: user?.id,
        _plan: plan,
        _days: plan === "free" || dur === "forever" ? null : Number(dur),
        _note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success(plan === "free" ? "أُلغي الاشتراك" : "مُنح الاشتراك");
      void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("admin-") });
      setNote("");
      onClose();
    },
    onError: (e: Error) => toast.error(`تعذّر الحفظ: ${e.message}`),
  });

  return (
    <>
      <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إدارة اشتراك الحساب</DialogTitle>
            <DialogDescription dir="ltr" className="text-start">
              {user?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">الخطة</span>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="free">إلغاء الاشتراك (مجاني)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {plan !== "free" && (
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">المدة</span>
                <Select value={dur} onValueChange={setDur}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 يوماً</SelectItem>
                    <SelectItem value="90">90 يوماً</SelectItem>
                    <SelectItem value="365">سنة</SelectItem>
                    <SelectItem value="forever">دائم</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            )}
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">ملاحظة (اختياري)</span>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                className="h-9 text-xs"
              />
            </label>
            <Button
              className="w-full"
              disabled={save.isPending}
              onClick={() => (plan === "free" ? setConfirmCancel(true) : save.mutate())}
            >
              {save.isPending ? "جارٍ الحفظ…" : plan === "free" ? "إلغاء الاشتراك" : "منح الاشتراك"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmCancel} onOpenChange={(open) => !open && setConfirmCancel(false)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد إلغاء الاشتراك</DialogTitle>
            <DialogDescription>
              سيعود {user?.email ?? "هذا الحساب"} إلى الخطة المجانية. هل تريد المتابعة؟
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              العودة
            </Button>
            <Button
              variant="destructive"
              disabled={save.isPending}
              onClick={() => {
                setConfirmCancel(false);
                save.mutate();
              }}
            >
              تأكيد الإلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ───────── الاشتراكات ───────── */

function SubsTab() {
  const [target, setTarget] = useState<{ id: string; email: string | null; plan: string } | null>(
    null,
  );
  const q = useQuery({
    queryKey: ["admin-subs"],
    queryFn: () => adminRpc<Subscriptions>("admin_subscriptions"),
  });

  if (q.isError) return <ErrorNote error={q.error} />;
  if (!q.data) return <Loading rows={4} />;
  const { active, audit } = q.data;

  return (
    <div className="space-y-4">
      <Panel title="الاشتراكات الفعّالة" hint={`${nf(active.length)} حساب`}>
        {active.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            لا اشتراكات فعّالة. امنح اشتراكاً من تبويب «الحسابات».
          </p>
        ) : (
          <TableShell minWidth={640}>
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  الحساب
                </th>
                <th scope="col" className={TH}>
                  الخطة
                </th>
                <th scope="col" className={TH}>
                  ينتهي
                </th>
                <th scope="col" className={TH}>
                  ملاحظة
                </th>
                <th scope="col" className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => (
                <tr key={s.user_id}>
                  <td className={TD}>
                    <span dir="ltr" className="font-medium">
                      {s.email}
                    </span>
                  </td>
                  <td className={TD}>
                    <PlanBadge plan={s.plan} />
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {s.expires_at ? dateOf(s.expires_at) : "دائم"}
                  </td>
                  <td className={`${TD} text-muted-foreground`}>{s.note ?? "—"}</td>
                  <td className={TD}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setTarget({ id: s.user_id, email: s.email, plan: s.plan })}
                    >
                      تعديل
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <Panel title="سجل العمليات" hint="آخر 40 عملية">
        {audit.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">لا عمليات بعد.</p>
        ) : (
          <ul className="divide-y divide-border/50 text-xs">
            {audit.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  {a.details.plan === "free"
                    ? "أُلغي اشتراك"
                    : `مُنحت خطة ${PLAN_LABEL[a.details.plan ?? ""] ?? a.details.plan}`}{" "}
                  <span dir="ltr" className="font-medium">
                    {a.target_email ?? "—"}
                  </span>
                  {a.details.days
                    ? ` لمدة ${a.details.days} يوماً`
                    : a.details.plan !== "free"
                      ? " (دائم)"
                      : ""}
                </span>
                <span className="text-muted-foreground">{ago(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <GrantDialog user={target} onClose={() => setTarget(null)} />
    </div>
  );
}
import { useEffect } from "react";
