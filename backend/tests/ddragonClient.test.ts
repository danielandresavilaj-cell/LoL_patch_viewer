import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DDragonClient,
  DDragonError,
  VERSIONS_TTL_MS,
  CHAMPIONS_TTL_MS,
  ITEMS_TTL_MS,
} from "../src/services/ddragonClient.js";
import { MemoryCache } from "../src/cache/memoryCache.js";
import type {
  DDragonChampionListResponse,
  DDragonItemListResponse,
} from "../src/types/ddragon.js";

const mockVersions = ["16.17.1", "16.16.1", "16.15.1"];

const mockChampionList: DDragonChampionListResponse = {
  type: "champion",
  format: "standAloneComplex",
  version: "16.17.1",
  data: {
    Ahri: {
      id: "Ahri",
      key: "103",
      name: "Ahri",
      title: "the Nine-Tailed Fox",
      blurb: "Vastaya fox mage.",
      tags: ["Mage", "Assassin"],
      partype: "Mana",
      info: { attack: 3, defense: 4, magic: 8, difficulty: 5 },
      stats: { hp: 590, mp: 418, movespeed: 330 },
      image: {
        full: "Ahri.png",
        sprite: "champion0.png",
        group: "champion",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
      },
    },
    Garen: {
      id: "Garen",
      key: "86",
      name: "Garen",
      title: "The Might of Demacia",
      blurb: "Demacian soldier.",
      tags: ["Fighter", "Tank"],
      partype: "None",
      info: { attack: 7, defense: 7, magic: 1, difficulty: 5 },
      stats: { hp: 690, mp: 0, movespeed: 340 },
      image: {
        full: "Garen.png",
        sprite: "champion0.png",
        group: "champion",
        x: 48,
        y: 0,
        w: 48,
        h: 48,
      },
    },
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DDragonClient", () => {
  let cache: MemoryCache;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cache = new MemoryCache();
    fetchMock = vi.fn();
  });

  it("fetches and caches versions", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockVersions));

    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const first = await client.getVersions();
    const second = await client.getVersions();

    expect(first).toEqual(mockVersions);
    expect(second).toEqual(mockVersions);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://ddragon.leagueoflegends.com/api/versions.json",
    );
    expect(cache.get<string[]>("versions")).toEqual(mockVersions);
  });

  it("returns latest version as first entry", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockVersions));
    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(client.getLatestVersion()).resolves.toBe("16.17.1");
  });

  it("fetches and caches champion list for a version", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockChampionList));

    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const first = await client.getChampionList("16.17.1");
    const second = await client.getChampionList("16.17.1");

    expect(first.version).toBe("16.17.1");
    expect(Object.keys(first.data)).toEqual(["Ahri", "Garen"]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.has("champions:16.17.1:en_US")).toBe(true);
  });

  it("resolves latest version before loading champions when omitted", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(mockVersions))
      .mockResolvedValueOnce(jsonResponse(mockChampionList));

    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const list = await client.getChampionList();
    expect(list.version).toBe("16.17.1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("builds CDN image URLs", () => {
    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(client.imageUrl("16.17.1", "Ahri.png")).toBe(
      "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/champion/Ahri.png",
    );
  });

  it("throws DDragonError on HTTP failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500));
    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(client.getVersions()).rejects.toBeInstanceOf(DDragonError);
    await expect(client.getVersions()).rejects.toMatchObject({ statusCode: 502 });
  });

  it("throws on empty versions payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await expect(client.getVersions()).rejects.toMatchObject({
      message: expect.stringContaining("Invalid versions"),
    });
  });

  it("fetches and caches item list for a version", async () => {
    const mockItemList: DDragonItemListResponse = {
      type: "item",
      version: "16.17.1",
      data: {
        "1001": {
          name: "Boots",
          description: "<stats><attention>25</attention> Move Speed</stats>",
          plaintext: "MS",
          image: {
            full: "1001.png",
            sprite: "item0.png",
            group: "item",
            x: 0,
            y: 0,
            w: 48,
            h: 48,
          },
          gold: { base: 300, purchasable: true, total: 300, sell: 210 },
          tags: ["Boots"],
          stats: { FlatMovementSpeedMod: 25 },
        },
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(mockItemList));

    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const first = await client.getItemList("16.17.1");
    const second = await client.getItemList("16.17.1");

    expect(first.version).toBe("16.17.1");
    expect(Object.keys(first.data)).toEqual(["1001"]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/item.json",
    );
    expect(cache.has("items:16.17.1:en_US")).toBe(true);
  });

  it("builds CDN item image URLs", () => {
    const client = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(client.itemImageUrl("16.17.1", "3115.png")).toBe(
      "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/item/3115.png",
    );
  });

  it("exposes TTL constants used for caching", () => {
    expect(VERSIONS_TTL_MS).toBe(3_600_000);
    expect(CHAMPIONS_TTL_MS).toBe(1_800_000);
    expect(ITEMS_TTL_MS).toBe(1_800_000);
  });
});
