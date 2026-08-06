import { BasiraLogo } from "@/components/BasiraLogo";

/** الحالة الفارغة: الشعار المعتمد بشكل خفيف فوق شبكة باهتة. */
export function EmptyIllustration({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="relative mx-auto flex h-28 w-full items-center justify-center">
        <svg
          viewBox="0 0 220 112"
          fill="none"
          className="absolute inset-0 h-full w-full text-foreground"
          aria-hidden
          focusable="false"
        >
          <g stroke="currentColor" strokeWidth="1" opacity="0.07">
            {[16, 48, 80, 104].map((y) => (
              <path key={y} d={`M10 ${y}h200`} />
            ))}
            {[10, 60, 110, 160, 210].map((x) => (
              <path key={x} d={`M${x} 12v88`} />
            ))}
          </g>
        </svg>
        <BasiraLogo className="relative h-16 w-auto opacity-40" />
      </div>
    </div>
  );
}