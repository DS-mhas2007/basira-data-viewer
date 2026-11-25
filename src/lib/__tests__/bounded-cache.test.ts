import { describe, expect, it } from "vitest";
import { setBoundedCacheEntry } from "../bounded-cache";

describe("setBoundedCacheEntry", () => {
  it("evicts the oldest entry when the cache exceeds its limit", () => {
    const cache = new Map<string, number>([["first", 1], ["second", 2]]);
    setBoundedCacheEntry(cache, "third", 3, 2);

    expect([...cache.entries()]).toEqual([["second", 2], ["third", 3]]);
  });

  it("refreshes an existing key without growing the cache", () => {
    const cache = new Map<string, number>([["first", 1], ["second", 2]]);
    setBoundedCacheEntry(cache, "first", 10, 2);

    expect([...cache.entries()]).toEqual([["second", 2], ["first", 10]]);
  });

  it("rejects invalid cache limits", () => {
    expect(() => setBoundedCacheEntry(new Map(), "key", 1, 0)).toThrow(RangeError);
    expect(() => setBoundedCacheEntry(new Map(), "key", 1, 1.5)).toThrow(RangeError);
  });
});
