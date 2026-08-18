import { useState, useCallback, useRef } from 'react'
import type { ParsedSheet } from '../lib/parse-file'

export type DBStatus = 'uninitialized' | 'initializing' | 'ready' | 'loading' | 'error'

export interface TableInfo {
  rowCount: number
  columns: string[]
}

export interface FetchRowsOptions {
  offset: number
  limit: number
  search?: string
  sortCol?: string
  sortDir?: 'asc' | 'desc'
}

export interface UseDuckDBTableReturn {
  dbStatus: DBStatus
  tableInfo: TableInfo | null
  error: string | null
  initDB: () => Promise<void>
  loadData: (sheet: ParsedSheet) => Promise<void>
  fetchRows: (opts: FetchRowsOptions) => Promise<Record<string, unknown>[]>
  countRows: (search?: string) => Promise<number>
  dispose: () => Promise<void>
}

export function useDuckDBTable(): UseDuckDBTableReturn {
  const [dbStatus, setDbStatus] = useState<DBStatus>('uninitialized')
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const serviceRef = useRef<any>(null)

  const initDB = useCallback(async () => {
    if (dbStatus === 'ready' || dbStatus === 'initializing') return
    setDbStatus('initializing')
    setError(null)
    try {
      const svc = await import('../lib/duckdb-service')
      await svc.initDuckDB()
      serviceRef.current = svc
      setDbStatus('ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تهيئة محرك البيانات'
      setError(msg)
      setDbStatus('error')
    }
  }, [dbStatus])

  const loadData = useCallback(async (sheet: ParsedSheet) => {
    if (!serviceRef.current) {
      setError('محرك البيانات غير مهيأ')
      return
    }
    setDbStatus('loading')
    setError(null)
    try {
      await serviceRef.current.loadSheet(sheet)
      setTableInfo({
        rowCount: sheet.rows.length,
        columns: sheet.columns.map((c: any) => c.name),
      })
      setDbStatus('ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل البيانات'
      setError(msg)
      setDbStatus('error')
    }
  }, [])

  const fetchRows = useCallback(async (opts: FetchRowsOptions): Promise<Record<string, unknown>[]> => {
    if (!serviceRef.current) return []
    try {
      return await serviceRef.current.fetchRows(opts)
    } catch {
      return []
    }
  }, [])

  const countRows = useCallback(async (search?: string): Promise<number> => {
    if (!serviceRef.current) return 0
    try {
      return await serviceRef.current.countRows(search)
    } catch {
      return 0
    }
  }, [])

  const dispose = useCallback(async () => {
    if (serviceRef.current?.dispose) {
      await serviceRef.current.dispose()
    }
    serviceRef.current = null
    setDbStatus('uninitialized')
    setTableInfo(null)
  }, [])

  return { dbStatus, tableInfo, error, initDB, loadData, fetchRows, countRows, dispose }
}
