import { altTableRows } from "@/lib/chart-a11y";
import { formatValue, type ChartConfig, type ChartPoint } from "@/lib/chart-studio";

/** جدول بديل للنقاط المرسومة: يخدم قارئ الشاشة ومن يريد القيم الدقيقة. */
export function ChartDataTable({ config, points }: { config: ChartConfig; points: ChartPoint[] }) {
  const { rows, hidden } = altTableRows(points);
  if (points.length === 0) return null;
  const hasSeries = rows.some((p) => p.series !== undefined);
  return (
    <details className="rounded-lg border border-white/10 px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none text-muted-foreground">
        عرض البيانات كجدول ({points.length})
      </summary>
      <div className="mt-2 max-h-48 overflow-auto">
        <table className="w-full text-start">
          <caption className="sr-only">{`${config.y} حسب ${config.x}`}</caption>
          <thead>
            <tr>
              <th scope="col" className="text-start">
                {config.x}
              </th>
              {hasSeries && (
                <th scope="col" className="text-start">
                  السلسلة
                </th>
              )}
              <th scope="col" className="text-start">
                {config.y}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={`${p.label}-${p.series ?? ""}-${i}`}>
                <th scope="row" className="text-start font-normal">
                  {p.label}
                </th>
                {hasSeries && <td>{p.series ?? ""}</td>}
                <td dir="ltr" className="text-end tabular-nums">
                  {formatValue(p.value, config)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hidden > 0 && <p className="mt-1 text-muted-foreground">و{hidden} صف إضافي غير معروض.</p>}
      </div>
    </details>
  );
}
