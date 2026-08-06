/**
 * الوحدة 9: لوحة الملخص البصري — رسوم تلقائية مبنية على توصيف الأعمدة.
 */
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarRange, Hash, Tags } from "lucide-react";
import type { TableInfo } from "@/lib/duckdb-service";
import {
  formatNumber,
  isDateColumn,
  isNumericType,
  profileDataset,
  type ColumnProfile,
  type DatasetProfile,
} from "@/lib/profile";

const AXIS = { fontSize: 10, fill: "var(--muted-foreground)" } as const;

function CardShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="clay clay-lift space-y-3 rounded-2xl border border-border/70 bg-card px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-sm font-semibold leading-tight">
            {title}
          </p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ChartTooltip() {
  return (
    <Tooltip
      cursor={{ fill: "var(--muted)", opacity: 0.25 }}
      contentStyle={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        fontSize: 12,
        direction: "rtl",
      }}
      labelStyle={{ color: "var(--muted-foreground)" }}
    />
  );
}

function ProfileCard({ profile }: { profile: ColumnProfile }) {
  if (profile.kind === "numeric") {
    return (
      <CardShell
        icon={<Hash className="size-4" strokeWidth={2} />}
        title={profile.column}
        subtitle={`المتوسط ${formatNumber(profile.avg)} · الوسيط ${formatNumber(profile.median)}`}
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: "الأدنى", v: formatNumber(profile.min) },
            { l: "الأعلى", v: formatNumber(profile.max) },
            { l: "فارغة", v: formatNumber(profile.nulls) },
          ].map((m) => (
            <div key={m.l} className="clay-inset rounded-xl border border-border/60 px-2 py-2 text-center">
              <p className="font-mono text-sm font-bold text-primary">{m.v}</p>
              <p className="text-[10px] text-muted-foreground">{m.l}</p>
            </div>
          ))}
        </div>
        {profile.histogram.length > 0 && (
          <div className="h-32" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profile.histogram} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip />
                <Bar dataKey="count" name="العدد" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardShell>
    );
  }

  if (profile.kind === "categorical") {
    return (
      <CardShell
        icon={<Tags className="size-4" strokeWidth={2} />}
        title={profile.column}
        subtitle={`${formatNumber(profile.distinct)} قيمة مختلفة · أعلى ${profile.top.length}`}
      >
        <div className="h-40" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={profile.top}
              layout="vertical"
              margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" opacity={0.4} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <ChartTooltip />
              <Bar dataKey="count" name="التكرار" fill="var(--accent)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell
      icon={<CalendarRange className="size-4" strokeWidth={2} />}
      title={profile.column}
      subtitle={`الاتجاه الزمني عبر ${profile.points.length} فترة`}
    >
      <div className="h-40" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={profile.points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" opacity={0.4} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
            <ChartTooltip />
            <Area
              type="monotone"
              dataKey="count"
              name="عدد الصفوف"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#trendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

/** هيكل عظمي لبطاقة رسم أثناء حساب الإحصاءات عبر SQL. */
function SkeletonCard({ bars }: { bars: number[] }) {
  return (
    <div className="clay space-y-3 rounded-2xl border border-border/70 bg-card px-4 py-4" aria-hidden>
      <div className="flex items-center gap-2">
        <div className="shimmer size-7 shrink-0 rounded-lg bg-primary/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="shimmer h-3 w-28 rounded bg-muted-foreground/20" />
          <div className="shimmer h-2.5 w-40 rounded bg-muted/70" />
        </div>
      </div>
      <div className="flex h-40 items-end gap-2 pt-2">
        {bars.map((h, i) => (
          <div
            key={i}
            className="shimmer flex-1 rounded-t-md bg-muted/60"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

const SKELETON_BARS = [
  [45, 78, 32, 60, 88, 40, 55, 70],
  [70, 40, 85, 55, 30, 65, 48, 76],
  [60, 88, 44, 72, 36, 58, 80, 50],
  [82, 50, 66, 38, 74, 46, 62, 34],
];

function DashboardSkeleton({ count }: { count: number }) {
  return (
    <div className="rise-in grid gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} bars={SKELETON_BARS[i % SKELETON_BARS.length]!} />
      ))}
      <p className="col-span-full text-center text-xs text-muted-foreground">
        جارٍ حساب الإحصاءات عبر SQL…
      </p>
    </div>
  );
}

export function DashboardPanel({
  tableInfo,
  sourceKey,
}: {
  tableInfo: TableInfo | null;
  /** يتغيّر عند تبديل ورقة العمل أو رفع ملف جديد لإعادة حساب المخططات. */
  sourceKey?: string;
}) {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!tableInfo) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setProfile(null);
    profileDataset(tableInfo)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tableInfo, sourceKey]);

  if (loading || (!!tableInfo && !profile && !failed)) {
    const expected = tableInfo
      ? Math.min(
          6,
          Math.max(
            2,
            tableInfo.schema.filter(
              (c) => isNumericType(c.type) || !isDateColumn(c.type, c.name),
            ).length,
          ),
        )
      : 2;
    return <DashboardSkeleton count={expected} />;
  }

  if (!profile || profile.cards.length === 0) {
    return (
      <div className="clay rounded-2xl border border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        <BarChart3 className="mx-auto mb-2 size-5 text-primary" strokeWidth={2} />
        لا توجد أعمدة كافية لبناء ملخص بصري.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {profile.cards.map((c) => (
        <ProfileCard key={`${c.kind}-${c.column}`} profile={c} />
      ))}
    </div>
  );
}