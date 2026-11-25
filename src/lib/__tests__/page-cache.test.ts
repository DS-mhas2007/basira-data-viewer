import { describe, expect, it } from "vitest";
import {
  MAX_DATA_TABLE_PAGE_CACHE_ENTRIES,
  setBoundedPageCacheEntry,
} from "../page-cache";

describe("DataTable page cache bound", () => {
  it("evicts the oldest page when the cache exceeds its limit", () => {
    const cache = new Map<string, number>();
    setBoundedPageCacheEntry(cache, "page-1", 1, 2);
    setBoundedPageCacheEntry(cache, "page-2", 2, 2);
    setBoundedPageCacheEntry(cache, "page-3", 3, 2);

    expect([...cache.entries()]).toEqual([["page-2", 2], ["page-3", 3]]);
  });

  it("keeps the cache within the production limit", () => {
    const cache = new Map<string, number>();
    for (let i = 0; i < MAX_DATA_TABLE_PAGE_CACHE_ENTRIES + 5; i += 1) {
      setBoundedPageCacheEntry(cache, `page-${i}`, i);
    }

    expect(cache.size).toBe(MAX_DATA_TABLE_PAGE_CACHE_ENTRIES);
    expect(cache.has("page-0")).toBe(false);
    expect(cache.has("page-5")).toBe(true);
  });
});
