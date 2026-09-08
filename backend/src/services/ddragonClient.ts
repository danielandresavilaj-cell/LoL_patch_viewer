import type {
  DDragonChampionListResponse,
  DDragonItemListResponse,
} from "../types/ddragon.js";
import { MemoryCache } from "../cache/memoryCache.js";

export const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";
export const DEFAULT_LOCALE = "en_US";

export const VERSIONS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const CHAMPIONS_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const ITEMS_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class DDragonError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DDragonError";
  }
}

export interface DDragonClientOptions {
  baseUrl?: string;
  locale?: string;
  cache?: MemoryCache;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class DDragonClient {
  private readonly baseUrl: string;
  private readonly locale: string;
  private readonly cache: MemoryCache;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: DDragonClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DDRAGON_BASE;
    this.locale = options.locale ?? DEFAULT_LOCALE;
    this.cache = options.cache ?? new MemoryCache();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async getVersions(): Promise<string[]> {
    const cacheKey = "versions";
    const cached = this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/api/versions.json`;
    const data = await this.fetchJson<string[]>(url);
    if (!Array.isArray(data) || data.length === 0) {
      throw new DDragonError("Invalid versions payload from Data Dragon", 502);
    }
    this.cache.set(cacheKey, data, VERSIONS_TTL_MS);
    return data;
  }

  async getLatestVersion(): Promise<string> {
    const versions = await this.getVersions();
    return versions[0];
  }

  async getChampionList(
    version?: string,
  ): Promise<DDragonChampionListResponse> {
    const resolvedVersion = version ?? (await this.getLatestVersion());
    const cacheKey = `champions:${resolvedVersion}:${this.locale}`;
    const cached = this.cache.get<DDragonChampionListResponse>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/cdn/${resolvedVersion}/data/${this.locale}/champion.json`;
    const data = await this.fetchJson<DDragonChampionListResponse>(url);
    if (!data?.data || typeof data.data !== "object") {
      throw new DDragonError("Invalid champion list payload from Data Dragon", 502);
    }
    this.cache.set(cacheKey, data, CHAMPIONS_TTL_MS);
    return data;
  }

  async getItemList(version?: string): Promise<DDragonItemListResponse> {
    const resolvedVersion = version ?? (await this.getLatestVersion());
    const cacheKey = `items:${resolvedVersion}:${this.locale}`;
    const cached = this.cache.get<DDragonItemListResponse>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/cdn/${resolvedVersion}/data/${this.locale}/item.json`;
    const data = await this.fetchJson<DDragonItemListResponse>(url);
    if (!data?.data || typeof data.data !== "object") {
      throw new DDragonError("Invalid item list payload from Data Dragon", 502);
    }
    this.cache.set(cacheKey, data, ITEMS_TTL_MS);
    return data;
  }

  imageUrl(version: string, imageFull: string): string {
    return `${this.baseUrl}/cdn/${version}/img/champion/${imageFull}`;
  }

  itemImageUrl(version: string, imageFull: string): string {
    return `${this.baseUrl}/cdn/${version}/img/item/${imageFull}`;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new DDragonError(
          `Data Dragon request failed: ${response.status} ${response.statusText}`,
          response.status >= 500 ? 502 : response.status,
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof DDragonError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new DDragonError("Data Dragon request timed out", 504, err);
      }
      throw new DDragonError("Failed to reach Data Dragon", 502, err);
    } finally {
      clearTimeout(timer);
    }
  }
}
