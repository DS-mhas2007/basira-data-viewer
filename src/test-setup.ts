import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll } from 'vitest'

vi.mock('@duckdb/duckdb-wasm', () => ({
  default: vi.fn(),
  createWorker: vi.fn(),
  ConsoleLogger: vi.fn(),
  LogLevel: { WARNING: 1 },
}))

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
    decode_range: vi.fn(),
  },
}))

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})
