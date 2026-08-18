import { useState, useCallback, useEffect } from 'react'
import type { ParsedFile } from '../lib/parse-file'

export interface SessionState {
  parsedFile: ParsedFile | null
  activeSheet: number
  fileName: string | null
}

export interface UseWorkspaceSessionReturn {
  session: SessionState
  saveSession: (state: SessionState) => Promise<void>
  loadSession: () => Promise<SessionState | null>
  exportBasira: (state: SessionState, name?: string) => void
  importBasira: (file: File) => Promise<SessionState | null>
  clearSession: () => Promise<void>
  isLoading: boolean
}

const DEFAULT_SESSION: SessionState = {
  parsedFile: null,
  activeSheet: 0,
  fileName: null,
}

export function useWorkspaceSession(): UseWorkspaceSessionReturn {
  const [session, setSession] = useState<SessionState>(DEFAULT_SESSION)
  const [isLoading, setIsLoading] = useState(false)

  const saveSession = useCallback(async (state: SessionState) => {
    try {
      const { saveWorkspace } = await import('../lib/workspace-store')
      await saveWorkspace(state as never)
      setSession(state)
    } catch (err) {
      console.error('فشل حفظ الجلسة:', err)
    }
  }, [])

  const loadSession = useCallback(async (): Promise<SessionState | null> => {
    setIsLoading(true)
    try {
      const { loadWorkspace } = await import('../lib/workspace-store')
      const saved = await loadWorkspace()
      if (saved) {
        const s = saved as unknown as SessionState
        setSession(s)
        return s
      }
      return null
    } catch (err) {
      console.error('فشل تحميل الجلسة:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const exportBasira = useCallback((state: SessionState, name?: string) => {
    const payload = { version: 1, ...state }
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name ?? state.fileName ?? 'workspace'}.basira`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const importBasira = useCallback((file: File): Promise<SessionState | null> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as SessionState
          setSession(data)
          resolve(data)
        } catch {
          reject(new Error('ملف .basira غير صالح أو تالف'))
        }
      }
      reader.onerror = () => reject(new Error('فشل قراءة الملف'))
      reader.readAsText(file)
    })
  }, [])

  const clearSession = useCallback(async () => {
    try {
      const { clearWorkspace } = await import('../lib/workspace-store')
      await clearWorkspace()
    } catch (err) {
      console.error('فشل مسح الجلسة:', err)
    } finally {
      setSession(DEFAULT_SESSION)
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  return { session, saveSession, loadSession, exportBasira, importBasira, clearSession, isLoading }
}
