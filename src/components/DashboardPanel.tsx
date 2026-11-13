/**
 * الوحدة 9: لوحة الملخص البصري — رسوم تلقائية مبنية على توصيف الأعمدة.
 */
import { useEffect, useMemo, useState } from "react";

import { BarChart3, CalendarRange, Hash, Tags } from "lucide-react";
import { EChartsView } from "@/components/EChartsView";
import type { EChartsOption } from "echarts";
import type { TableInfo } from "@/lib/duckdb-service";
import {
  formatNumber,
  isDateColumn,
  isNumericType,
  profileDataset,
  type ColumnProfile,
  type DatasetProfile,
} from "@/lib/profile";

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
    <div className="space-y-3 rounded-[18px_8px_18px_8px] border border-border/80 bg-surface-1 px-4 py-4">
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

function ProfileCard({ profile }: { profile: ColumnProfile }) {
  const chartOption = useMemo<EChartsOption>(() => {
    const axisLabel = { color: "#AAB7C9", hideOverlap: true };
    const grid = { left: 8, right: 12, top: 12, bottom: 8, containLabel: true };

    if (profile.kind === "numeric") {
      return {
        color: ["#60F5D2"],
        grid,
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: profile.histogram.map((point) => point.label), axisLabel },
        yAxis: { type: "value", axisLabel },
        series: [{
          name: "العدد",
          type: "bar",
          data: profile.histogram.map((point) => point.count),
          itemStyle: { borderRadius: [6, 6, 0, 0] },
        }],
      };
    }

    if (profile.kind === "categorical") {
      return {
        color: ["#D6B2FC"],
        grid,
        tooltip: { trigger: "axis" },
        xAxis: { type: "value", axisLabel },
        yAxis: {
          type: "category",
          inverse: true,
          data: profile.top.map((point) => point.label),
          axisLabel: { ...axisLabel, width: 76, overflow: "truncate" },
        },
        series: [{
          name: "التكرار",
          type: "bar",
          data: profile.top.map((point) => point.count),
          itemStyle: { borderRadius: [0, 6, 6, 0] },
        }],
      };
    }

    return {
      color: ["#60F5D2"],
      grid,
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: profile.points.map((point) => point.label), axisLabel },
      yAxis: { type: "value", axisLabel },
      series: [{
        name: "عدد الصفوف",
        type: "line",
        smooth: true,
        data: profile.points.map((point) => point.count),
        symbol: "none",
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.12 },
      }],
    };
  }, [profile]);

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
            <div key={m.l} className="rounded-xl border border-border/70 bg-surface-2/55 px-2 py-2 text-center">
              <p className="font-mono text-sm font-bold text-primary">{m.v}</p>
              <p className="text-[10px] text-muted-foreground">{m.l}</p>
            </div>
          ))}
        </div>
        {profile.histogram.length > 0 && (
          <div className="h-32" dir="ltr">
            <EChartsView option={chartOption} label={profile.column} />
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
          <EChartsView option={chartOption} label={profile.column} />
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
        <EChartsView option={chartOption} label={profile.column} />
      </div>
    </CardShell>
  );
}

/** هيكل عظمي لبطاقة رسم أثناء حساب الإحصاءات عبر SQL. */
function SkeletonCard({ bars }: { bars: number[] }) {
  return (
    <div className="space-y-3 rounded-[18px_8px_18px_8px] border border-border/80 bg-surface-1 px-4 py-4" aria-hidden>
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
      <div className="rounded-[18px_8px_18px_8px] border border-border/80 bg-surface-1 px-4 py-8 text-center text-sm text-muted-foreground">
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