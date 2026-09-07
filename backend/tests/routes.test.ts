import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { DDragonClient, DDragonError } from "../src/services/ddragonClient.js";
import { ChampionService } from "../src/services/championService.js";
import { MemoryCache } from "../src/cache/memoryCache.js";
import type { DDragonChampionListResponse } from "../src/types/ddragon.js";

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

describe("API routes", () => {
  let app: FastifyInstance;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi.fn();
    const cache = new MemoryCache();
    const ddragonClient = new DDragonClient({
      cache,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const championService = new ChampionService(ddragonClient);
    app = await buildApp({ cache, ddragonClient, championService });
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "ok",
      service: "lol-champion-patch-viewer-api",
    });
  });

  it("GET /api/versions returns latest and list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockVersions));

    const res = await app.inject({ method: "GET", url: "/api/versions" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      latest: "16.17.1",
      count: 3,
      versions: mockVersions,
    });
  });

  it("GET /api/patches/latest returns version and previous", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockVersions));

    const res = await app.inject({ method: "GET", url: "/api/patches/latest" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      version: "16.17.1",
      previous: "16.16.1",
      recent: mockVersions,
    });
  });

  it("GET /api/champions returns normalized list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockChampionList));

    const res = await app.inject({
      method: "GET",
      url: "/api/champions?version=16.17.1",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe("16.17.1");
    expect(body.count).toBe(2);
    expect(body.champions.map((c: { id: string }) => c.id)).toEqual([
      "Ahri",
      "Garen",
    ]);
  });

  it("GET /api/champions filters by q and tags", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockChampionList));

    const res = await app.inject({
      method: "GET",
      url: "/api/champions?version=16.17.1&q=ah&tags=Mage",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(1);
    expect(body.champions[0].id).toBe("Ahri");
  });

  it("GET /api/champions/:id returns champion detail", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockChampionList));

    const res = await app.inject({
      method: "GET",
      url: "/api/champions/Garen?version=16.17.1",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe("Garen");
    expect(body.stats.hp).toBe(690);
    expect(body.imageUrl).toContain("/cdn/16.17.1/img/champion/Garen.png");
  });

  it("GET /api/champions/:id is case-insensitive", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockChampionList));

    const res = await app.inject({
      method: "GET",
      url: "/api/champions/ahri?version=16.17.1",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("Ahri");
  });

  it("GET /api/champions/:id returns 404 for unknown id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockChampionList));

    const res = await app.inject({
      method: "GET",
      url: "/api/champions/NotAChamp?version=16.17.1",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: "Champion 'NotAChamp' not found",
      statusCode: 404,
    });
  });

  it("maps upstream Data Dragon failures to 502", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

    const res = await app.inject({ method: "GET", url: "/api/versions" });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({
      statusCode: 502,
      error: expect.stringContaining("Data Dragon"),
    });
  });

  it("maps timeout errors to 504", async () => {
    const cache = new MemoryCache();
    const failingClient = {
      getVersions: vi.fn().mockRejectedValue(
        new DDragonError("Data Dragon request timed out", 504),
      ),
      getChampionList: vi.fn(),
      getLatestVersion: vi.fn(),
      imageUrl: vi.fn(),
    } as unknown as DDragonClient;

    const isolated = await buildApp({
      cache,
      ddragonClient: failingClient,
      championService: new ChampionService(failingClient),
    });

    try {
      const res = await isolated.inject({ method: "GET", url: "/api/versions" });
      expect(res.statusCode).toBe(504);
      expect(res.json()).toEqual({
        error: "Data Dragon request timed out",
        statusCode: 504,
      });
    } finally {
      await isolated.close();
    }
  });

  it("returns 404 for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/unknown" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: "Not Found",
      statusCode: 404,
    });
  });
});
