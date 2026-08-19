import React, { useState, useEffect, useRef, useCallback } from 'react'

const PREVIEW_LIMIT = 1000
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 44
const MIN_CONTAINER_HEIGHT = 300
const OVERSCAN = 5

interface ColumnMeta { name: string; type?: string }
type ColumnInput = string | ColumnMeta
interface DataTableProps {
  fetchRows: (opts: { offset: number; limit: number; search?: string; sortCol?: string; sortDir?: 'asc' | 'desc' }) => Promise<Record<string, unknown>[]>
  countRows: (search: string) => Promise<number>
  columns: ColumnInput[]
  sourceKey: string
  tableName?: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t) }, [value, delay])
  return debounced
}

function useContainerHeight(ref: React.RefObject<HTMLDivElement>): number {
  const [height, setHeight] = useState(MIN_CONTAINER_HEIGHT)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) { const h = entry.contentRect.height; if (h > 0) setHeight(Math.max(h, MIN_CONTAINER_HEIGHT)) }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return height
}

function useVirtualRows(totalRows: number, scrollTop: number, containerHeight: number) {
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT)
  const rawStart = Math.floor(scrollTop / ROW_HEIGHT)
  const start = Math.max(0, rawStart - OVERSCAN)
  const end = Math.min(totalRows - 1, rawStart + visibleCount + OVERSCAN)
  return { start, end, totalHeight: totalRows * ROW_HEIGHT }
}

export function DataTable({ fetchRows, countRows, columns: columnsProp, sourceKey }: DataTableProps) {
  const columns: ColumnMeta[] = React.useMemo(
    () => (columnsProp ?? []).map((c) => (typeof c === 'string' ? { name: c } : c)).filter((c) => !!c?.name),
    [columnsProp],
  )
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [scrollTop, setScrollTop] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevSourceKey = useRef<string>('')
  const containerHeight = useContainerHeight(wrapperRef)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (prevSourceKey.current !== sourceKey) {
      prevSourceKey.current = sourceKey
      setSearch(''); setSortCol(null); setSortDir('asc'); setScrollTop(0); setRows([]); setTotalCount(0)
      if (containerRef.current) containerRef.current.scrollTop = 0
    }
  }, [sourceKey])

  useEffect(() => {
    if (!sourceKey) return
    countRows(debouncedSearch).then(setTotalCount).catch(() => setTotalCount(0))
  }, [sourceKey, debouncedSearch, countRows])

  const { start, end, totalHeight } = useVirtualRows(Math.min(totalCount, PREVIEW_LIMIT), scrollTop, containerHeight)

  useEffect(() => {
    if (!sourceKey || end < start) return
    setLoading(true); setError(null)
    fetchRows({ offset: start, limit: end - start + 1, search: debouncedSearch || undefined, sortCol: sortCol ?? undefined, sortDir })
      .then((data) => { setRows(data); setLoading(false) })
      .catch((err) => { setError(err instanceof Error ? err.message : 'خطأ في جلب البيانات'); setLoading(false) })
  }, [sourceKey, start, end, debouncedSearch, sortCol, sortDir, fetchRows])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => { setScrollTop(e.currentTarget.scrollTop) }, [])
  const handleSort = useCallback((col: string) => {
    setSortDir((prev) => (sortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')); setSortCol(col)
  }, [sortCol])

  if (!sourceKey) return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm" dir="rtl">لم يتم تحميل أي بيانات بعد</div>

  return (
    <div className="flex flex-col gap-3 w-full h-full" dir="rtl">
      <div className="flex items-center gap-2">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في البيانات…"
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-right" dir="rtl" />
        {loading && <svg className="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>}
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {totalCount > PREVIEW_LIMIT ? `عرض أول ${PREVIEW_LIMIT.toLocaleString('ar-EG')} صف من ${totalCount.toLocaleString('ar-EG')}` : `${totalCount.toLocaleString('ar-EG')} صف`}
        {debouncedSearch && ` — نتائج البحث عن "${debouncedSearch}"`}
      </p>
      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 text-right">{error}</div>}
      <div className="rounded-md border border-border overflow-hidden flex flex-col flex-1" ref={wrapperRef}>
        <div className="grid bg-muted/50 border-b border-border flex-shrink-0"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`, height: HEADER_HEIGHT }}>
          {columns.map((col) => (
            <button key={col.name} onClick={() => handleSort(col.name)}
              className="flex items-center justify-end gap-1 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors truncate text-right">
              {sortCol === col.name && <span className="text-foreground">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              <span className="truncate">{col.name}</span>
            </button>
          ))}
        </div>
        <div ref={containerRef} onScroll={handleScroll} className="overflow-y-auto overflow-x-auto flex-1"
          style={{ height: containerHeight, position: 'relative' }} dir="rtl">
          <div style={{ height: totalHeight, position: 'relative' }}>
            {rows.map((row, i) => {
              const absIndex = start + i
              if (absIndex > end) return null
              return (
                <div key={absIndex} className="grid border-b border-border/50 hover:bg-muted/30 transition-colors"
                  style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`, position: 'absolute', top: absIndex * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}>
                  {columns.map((col) => (
                    <div key={col.name} className="flex items-center justify-end px-3 text-sm truncate" title={String(row[col.name] ?? '')}>
                      {String(row[col.name] ?? '')}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          {rows.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              {debouncedSearch ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد بيانات'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DataTable