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

function SkeletonCard() {
  return (
    <div className="clay h-56 animate-pulse rounded-2xl border border-border/70 bg-card/60" />
  );
}

export function DashboardPanel({ tableInfo }: { tableInfo: TableInfo | null }) {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tableInfo) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    profileDataset(tableInfo)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tableInfo]);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
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