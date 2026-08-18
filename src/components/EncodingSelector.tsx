import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const ENCODING_OPTIONS = [
  { value: 'auto', label: 'Auto (Recommended)', description: 'Detects encoding automatically' },
  { value: 'utf-8', label: 'UTF-8', description: 'Most common universal encoding' },
  { value: 'windows-1256', label: 'Windows-1256 (Arabic)', description: 'For legacy Arabic files' },
]

export interface EncodingSelectorProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

export function EncodingSelector({ value, onChange, disabled = false }: EncodingSelectorProps) {
  const selectedOption = ENCODING_OPTIONS.find((opt) => opt.value === value)

  return (
    <div className="flex flex-col gap-1.5 w-full" dir="rtl">
      <Label htmlFor="encoding-select" className="text-sm font-medium">
        File Encoding
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="encoding-select" className="w-full text-right" dir="rtl">
          <SelectValue placeholder="Select file encoding..." />
        </SelectTrigger>
        <SelectContent dir="rtl" align="end">
          {ENCODING_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-right">
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedOption && (
        <p className="text-xs text-muted-foreground text-right">{selectedOption.description}</p>
      )}
    </div>
  )
}

export default EncodingSelector
