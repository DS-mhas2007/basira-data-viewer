import { describe, it, expect } from 'vitest'
import {
  validateFile,
  decodeBuffer,
  detectDelimiter,
  detectHeaderIndex,
} from '../parse-file'

function makeFile(name: string, size: number, type = 'text/plain'): File {
  const content = 'a'.repeat(size)
  const blob = new Blob([content], { type })
  return new File([blob], name, { type })
}

const MB = 1024 * 1024

describe('validateFile', () => {
  it('يقبل ملف CSV صالح', () => {
    const file = makeFile('data.csv', 100, 'text/csv')
    expect(() => validateFile(file)).not.toThrow()
  })

  it('يقبل ملف XLSX صالح', () => {
    const file = makeFile('data.xlsx', 200, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(() => validateFile(file)).not.toThrow()
  })

  it('يرفض ملفاً فارغاً (size=0)', () => {
    const file = makeFile('empty.csv', 0, 'text/csv')
    expect(() => validateFile(file)).toThrow()
  })

  it('يرفض امتداد .pdf', () => {
    const file = makeFile('report.pdf', 500, 'application/pdf')
    expect(() => validateFile(file)).toThrow()
  })

  it('يرفض امتداد .txt', () => {
    const file = makeFile('notes.txt', 500, 'text/plain')
    expect(() => validateFile(file)).toThrow()
  })

  it('يرفض ملفاً أكبر من 25 ميغابايت', () => {
    const file = makeFile('big.csv', 26 * MB, 'text/csv')
    expect(() => validateFile(file)).toThrow()
  })

  it('يقبل ملفاً بحجم 25 ميغابايت بالضبط', () => {
    const file = makeFile('exact.csv', 25 * MB, 'text/csv')
    expect(() => validateFile(file)).not.toThrow()
  })
})

describe('detectDelimiter', () => {
  it('يكتشف الفاصلة ,', () => {
    const sample = 'name,age,city\nأحمد,25,القاهرة\nمحمود,30,الرياض'
    expect(detectDelimiter(sample)).toBe(',')
  })

  it('يكتشف الفاصلة المنقوطة ;', () => {
    const sample = 'name;age;city\nأحمد;25;القاهرة\nمحمود;30;الرياض'
    expect(detectDelimiter(sample)).toBe(';')
  })

  it('يكتشف Tab', () => {
    const sample = 'name\tage\tcity\nأحمد\t25\tالقاهرة'
    expect(detectDelimiter(sample)).toBe('\t')
  })

  it('يرجع , كافتراضي عند الغموض', () => {
    const sample = 'hello world\nfoo bar'
    expect(detectDelimiter(sample)).toBe(',')
  })
})

describe('detectHeaderIndex', () => {
  it('يرجع 0 عند يكون الصف الأول هو الترويسة', () => {
    const rows = [
      ['الاسم', 'العمر'', 'المدينة'],
      ['أحمد', '25', 'القاهرة'],
    ]
    expect(detectHeaderIndex(rows)).toBe(0)
  })

  it('يتخطى صفاً واحداً من العنوان ويرجع 1', () => {
    const rows = [
      ['تقرير المبيعات'],
      ['الاسم', 'العمر', 'المدينة'],
      ['أحمد', '25', 'القاهرة'],
    ]
    expect(detectHeaderIndex(rows)).toBe(1)
  })

  it('لا يتخطى أكثر من 5 صفوف', () => {
    const rows = [
      ['عنوان 1'], ['عنوان 2'], ['عنوان 3'],
      ['عنوان 4'], ['عنوان 5'], ['عنوان 6'],
      ['الاسم', 'العمر'], ['أحمد', '25'],
    ]
    expect(detectHeaderIndex(rows)).toBeLessThanOrEqual(5)
  })

  it('يرجع 0 عند تمرير مصفوفة فارغة', () => {
    expect(detectHeaderIndex([])).toBe(0)
  })
})

describe('decodeBuffer', () => {
  it('يكتشف UTF-8 BOM ويعيد النص الصحيح', () => {
    const text = 'مرحبا'
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const encoded = new TextEncoder().encode(text)
    const buffer = new Uint8Array([...bom, ...encoded]).buffer
    expect(decodeBuffer(buffer)).toContain('مرحبا')
  })

  it('يرجع نصاً صحيراً لـ UTF-8 بدون BOM', () => {
    const text = 'hello world'
    const buffer = new TextEncoder().encode(text).buffer
    expect(decodeBuffer(buffer)).toBe('hello world')
  })

  it('يتعامل مع buffer فارغ دون رمي خطأ', () => {
    expect(() => decodeBuffer(new ArrayBuffer(0))).not.toThrow()
  })
})
