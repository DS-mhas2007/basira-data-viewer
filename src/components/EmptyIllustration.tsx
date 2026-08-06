/** رسم توضيحي بخطوط SVG بنفس أسلوب الشعار للحالة الفارغة. */
export function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 120" fill="none" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="empty-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60F5D2" />
          <stop offset="100%" stopColor="#D6B2FC" />
        </linearGradient>
      </defs>

      {/* شبكة خفيفة */}
      <g stroke="currentColor" strokeWidth="1" opacity="0.12">
        {[20, 50, 80, 110].map((y) => (
          <path key={y} d={`M14 ${y}h192`} />
        ))}
        {[14, 62, 110, 158, 206].map((x) => (
          <path key={x} d={`M${x} 14v92`} />
        ))}
      </g>

      {/* أعمدة بيانات */}
      <g stroke="url(#empty-stroke)" strokeWidth="2" strokeLinecap="round" opacity="0.55">
        <path d="M38 104V78" />
        <path d="M62 104V62" />
        <path d="M86 104V86" />
        <path d="M158 104V70" />
        <path d="M182 104V54" />
      </g>

      {/* عين تحتضن خط الاتجاه */}
      <path
        d="M74 56c12-19 23-27 36-27s24 8 36 27c-12 19-23 27-36 27s-24-8-36-27Z"
        stroke="url(#empty-stroke)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M96 63l9-11 8 7 13-15"
        stroke="url(#empty-stroke)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="126" cy="44" r="3.4" fill="url(#empty-stroke)" />
    </svg>
  );
}