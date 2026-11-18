import { cn } from "@/lib/utils";

export type ChartSkeletonKind = "bar" | "line" | "pie";

const BARS = [38, 62, 48, 80, 55, 92, 66, 74];

/** هيكل رسم متحرك (shimmer) يظهر قبل ظهور الرسم الحقيقي، بشكل يشبه نوعه. */
export function ChartSkeleton({
  kind = "bar",
  className,
}: {
  kind?: ChartSkeletonKind;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 flex items-end justify-center overflow-hidden p-4",
        className,
      )}
    >
      {kind === "pie" ? (
        <div className="mz-skel-pulse m-auto size-[min(70%,11rem)] rounded-full border-[18px] border-foreground/10" />
      ) : kind === "line" ? (
        <svg
          viewBox="0 0 200 80"
          preserveAspectRatio="none"
          className="mz-skel-pulse h-full w-full"
        >
          <path
            d="M0 60 C 20 40, 35 70, 55 48 S 90 20, 110 40 S 150 66, 170 28 S 190 24, 200 30 L200 80 L0 80 Z"
            fill="currentColor"
            className="text-foreground/[0.06]"
          />
          <path
            d="M0 60 C 20 40, 35 70, 55 48 S 90 20, 110 40 S 150 66, 170 28 S 190 24, 200 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
            className="text-foreground/20"
          />
        </svg>
      ) : (
        <div className="mz-skel-pulse flex h-full w-full items-end justify-around gap-2">
          {BARS.map((h, i) => (
            <span
              key={i}
              className="w-full max-w-4 rounded-full bg-foreground/10"
              style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
