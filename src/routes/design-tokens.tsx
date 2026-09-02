import React, { useEffect, useRef, useState } from 'react';
import '../styles/tokens.css';

export default function DesignTokensPreview() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bs-page">
      <h2 style={{ margin: 0, marginBottom: 12, fontSize: 20 }}>Basira — Design tokens preview</h2>
      <p style={{ marginTop: 0, color: 'var(--muted-foreground)' }}>
        LTR and RTL previews — motion respects <code>prefers-reduced-motion</code>.
      </p>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
        <section style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>LTR (default)</h3>
          <div className="bs-grid">
            <div className="bs-swatch">
              <div className="color-swatch" style={{ background: 'var(--color-bg)' }}></div>
              <div>Background</div>
              <small style={{ color: 'var(--muted-foreground)' }}>var(--color-bg)</small>
            </div>
            <div className="bs-swatch">
              <div className="color-swatch" style={{ background: 'var(--color-teal)' }}></div>
              <div>Primary / Teal</div>
              <small style={{ color: 'var(--muted-foreground)' }}>var(--color-teal)</small>
            </div>
            <div className="bs-swatch">
              <div className="color-swatch" style={{ background: 'var(--color-violet)' }}></div>
              <div>Secondary / Violet</div>
              <small style={{ color: 'var(--muted-foreground)' }}>var(--color-violet)</small>
            </div>
            <div className="bs-swatch">
              <div className="color-swatch" style={{ background: 'var(--color-offwhite)' }}></div>
              <div>Off-white</div>
              <small style={{ color: 'var(--muted-foreground)' }}>var(--color-offwhite)</small>
            </div>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch typo-sample">
            <h1>Heading — Syne</h1>
            <p>مثال نص عربي — Tajawal used for Arabic samples.</p>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch">
            <div className="spacing-sample">
              <div className="spacing-box">4</div>
              <div className="spacing-box">8</div>
              <div className="spacing-box">16</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch radius-demo">
            <div className="radius-box" style={{ borderRadius: 'var(--radius-sm)' }}>sm</div>
            <div className="radius-box" style={{ borderRadius: 'var(--radius-md)' }}>md</div>
            <div className="radius-box" style={{ borderRadius: 'var(--radius-lg)' }}>lg</div>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch shadow-demo">
            <div className="card">Card — shadow-sm</div>
            <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>Card — shadow-md</div>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className={`motion-primitive ${visible ? 'is-visible' : ''}`} aria-hidden style={{ padding: 8, background: 'var(--primary)', borderRadius: 6, color: 'var(--primary-foreground)' }}>
                Animated Chip
              </div>
              <div style={{ color: 'var(--muted-foreground)' }}>Subtle translate + fade (direction aware)</div>
            </div>
          </div>
        </section>

        <section style={{ padding: 12 }} dir="rtl">
          <h3 style={{ marginTop: 0 }}>RTL preview</h3>
          <div className="bs-grid">
            <div className="bs-swatch">
              <div className="color-swatch" style={{ background: 'var(--color-bg)' }}></div>
              <div>خلفية</div>
              <small style={{ color: 'var(--muted-foreground)' }}>var(--color-bg)</small>
            </div>
            <div className="bs-swatch">
              <div className="color-swatch" style={{ background: 'var(--color-teal)' }}></div>
              <div>الرئيسية / أخضر مزرق</div>
              <small style={{ color: 'var(--muted-foreground)' }}>var(--color-teal)</small>
            </div>
            <div className="bs-swatch">
              <div className="color-swatch" style={{ background: 'var(--color-violet)' }}></div>
              <div>الثانوية / بنفسجي</div>
              <small style={{ color: 'var(--muted-foreground)' }}>var(--color-violet)</small>
            </div>
            <div className="bs-swatch">
              <div className="color-swatch" style={{ background: 'var(--color-offwhite)' }}></div>
              <div>أبيض باهت</div>
              <small style={{ color: 'var(--muted-foreground)' }}>var(--color-offwhite)</small>
            </div>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch typo-sample">
            <h1 style={{ textAlign: 'right' }}>عنوان — Syne</h1>
            <p style={{ textAlign: 'right' }}>مثال عربي — الخط العربي مستخدم.</p>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch">
            <div className="spacing-sample">
              <div className="spacing-box">٤</div>
              <div className="spacing-box">٨</div>
              <div className="spacing-box">١٦</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch radius-demo">
            <div className="radius-box" style={{ borderRadius: 'var(--radius-sm)' }}>ص</div>
            <div className="radius-box" style={{ borderRadius: 'var(--radius-md)' }}>م</div>
            <div className="radius-box" style={{ borderRadius: 'var(--radius-lg)' }}>ك</div>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch shadow-demo">
            <div className="card">بطاقة</div>
            <div className="card" style={{ boxShadow: 'var(--shadow-md)' }}>بطاقة</div>
          </div>

          <div style={{ marginTop: 16 }} className="bs-swatch">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ color: 'var(--muted-foreground)' }}>ترجمة وحركة من اليمين</div>
              <div className={`motion-primitive ${visible ? 'is-visible' : ''}`} aria-hidden style={{ padding: 8, background: 'var(--secondary)', borderRadius: 6, color: 'var(--text-foreground)' }}>
                قِطعة متحركة
              </div>
            </div>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 20 }}>
        <small style={{ color: 'var(--muted-foreground)' }}>
          Design tokens are intentionally minimal — use these as semantic primitives across the app. Motion primitives honor the user's OS preference for reduced motion.
        </small>
      </div>
    </div>
  );
}
