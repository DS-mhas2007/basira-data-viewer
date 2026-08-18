import { useState, useCallback } from 'react'
import { parseFile } from '../lib/parse-file'
import type { ParsedFile } from '../lib/parse-file'

export type FileParserStatus = 'idle' | 'parsing' | 'success' | 'error'

export interface UseFileParserReturn {
  parsedFile: ParsedFile | null
  status: FileParserStatus
  error: string | null
  parse: (file: File) => Promise<void>
  reset: () => void
}

export function useFileParser(): UseFileParserReturn {
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null)
  const [status, setStatus] = useState<FileParserStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const parse = useCallback(async (file: File) => {
    setStatus('parsing')
    setError(null)
    setParsedFile(null)
    try {
      const result = await parseFile(file)
      setParsedFile(result)
      setStatus('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ غير معروف أثناء تحليل الملف'
      setError(msg)
      setStatus('error')
    }
  }, [])

  const reset = useCallback(() => {
    setParsedFile(null)
    setStatus('idle')
    setError(null)
  }, [])

  return { parsedFile, status, error, parse, reset }
}
