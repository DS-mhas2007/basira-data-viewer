/**
 * lazy-imports.ts
 * markaz al-tahmil al-kasul lil-mktabat al-thaqila fi mashrou basira-data-viewer.
 */

export async function loadDuckDB() {
  return import('./duckdb-service')
}

export async function loadXLSX() {
  return import('xlsx')
}

export async function loadAISDK() {
  return import('@ai-sdk/react')
}

export async function loadRecharts() {
  return import('recharts')
}

export type DuckDBModule = Awaited<ReturnType<typeof loadDuckDB>>
export type XLSXModule = Awaited<ReturnType<typeof loadXLSX>>
export type AISDKModule = Awaited<ReturnType<typeof loadAISDK>>
export type RechartsModule = Awaited<ReturnType<typeof loadRecharts>>
