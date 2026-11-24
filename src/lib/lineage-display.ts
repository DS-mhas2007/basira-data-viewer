/**
 * Format conservative SQL-lineage dependencies for display.
 * Prefer relation-qualified references when the resolver provides them;
 * fall back to legacy column names for older lineage payloads.
 */
export function formatLineageDependencies(
  columns?: readonly string[],
  references?: readonly { table: string; column: string }[],
): string[] {
  const qualified = (references ?? [])
    .map(({ table, column }) => [table.trim(), column.trim()].filter(Boolean).join("."))
    .filter(Boolean);
  const candidates = qualified.length > 0 ? qualified : (columns ?? []).map((column) => column.trim());
  return [...new Set(candidates.filter(Boolean))];
}
