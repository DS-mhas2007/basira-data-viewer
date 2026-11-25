/**
 * Insert a cache entry and evict the oldest entries until the cache is bounded.
 * Re-inserting an existing key refreshes its insertion order.
 */
export function setBoundedCacheEntry<T>(
  cache: Map<string, T>,
  key: string,
  value: T,
  maxEntries: number,
): void {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError("maxEntries must be a positive integer");
  }

  cache.delete(key);
  cache.set(key, value);

  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}
