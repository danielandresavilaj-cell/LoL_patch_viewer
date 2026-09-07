import { describe, it, expect, beforeEach } from "vitest";
import { MemoryCache } from "../src/cache/memoryCache.js";

describe("MemoryCache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(1_000);
  });

  it("stores and retrieves values", () => {
    cache.set("k", { n: 1 });
    expect(cache.get<{ n: number }>("k")).toEqual({ n: 1 });
    expect(cache.has("k")).toBe(true);
  });

  it("returns undefined for missing keys", () => {
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.has("missing")).toBe(false);
  });

  it("expires entries after TTL", async () => {
    cache.set("short", "value", 20);
    expect(cache.get("short")).toBe("value");
    await new Promise((r) => setTimeout(r, 35));
    expect(cache.get("short")).toBeUndefined();
  });

  it("clears all entries", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("deletes a single key", () => {
    cache.set("a", 1);
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
  });
});
