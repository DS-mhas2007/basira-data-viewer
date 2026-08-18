import React from 'react'
import type { DBStatus } from '@/hooks/useDuckDBTable'

interface DuckDBLoaderProps {
  status: DBStatus
  onRetry?: () => void
}

export function DuckDBLoader({ status, onRetry }: DuckDBLoaderProps) {
  if (status === 'uninitialized' || status === 'ready') return null

  if (status === 'initializing' || status === 'loading') {
    return (
      <div
        className="flex items-center justify-center gap-3 py-4 px-6 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground"
        dir="rtl"
        role="status"
        aria-live="polite"
      >
        <svg
          className="animate-spin h-5 w-5 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span>
          {status === 'initializing'
            ? 'جارٍ تهيئة محرك البيانات… qued يستغرق ذلك بضع ثوانٍ'
            : 'جارٍ تحميل البيانات في محرك الاستعلام…'}
        </span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive"
        dir="rtl"
        role="alert"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>فشل تهيئة محرك البيانات</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium underline underline-offset-2 hover:opacity-75 transition-opacity"
          >
            إعادة المحاولة
          </button>
        )}
      </div>
    )
  }

  return null
}

export default DuckDBLoader
