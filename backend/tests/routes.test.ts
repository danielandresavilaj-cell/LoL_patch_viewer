import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { DDragonClient, DDragonError } from "../src/services/ddragonClient.js";
import { ChampionService } from "../src/services/championService.js";
import { ItemService } from "../src/services/itemService.js";
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
      stats: {
        hp: 590,
        hpperlevel: 104,
        mp: 418,
        mpperlevel: 25,
        movespeed: 330,
        armor: 21,
        armorperlevel: 4.2,
        spellblock: 30,
        spellblockperlevel: 1.3,
        hpregen: 2.5,
        hpregenperlevel: 0.6,
        mpregen: 8,
        mpregenperlevel: 0.8,
        crit: 0,
        critperlevel: 0,
        attackdamage: 53,
        attackdamageperlevel: 0,
        attackspeedperlevel: 2.2,
        attackspeed: 0.668,
      },
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
      stats: {
        hp: 690,
        hpperlevel: 98,
        mp: 0,
        mpperlevel: 0,
        movespeed: 340,
        armor: 36,
        armorperlevel: 4.2,
        spellblock: 32,
        spellblockperlevel: 2.05,
        hpregen: 8,
        hpregenperlevel: 0.5,
        mpregen: 0,
        mpregenperlevel: 0,
        crit: 0,
        critperlevel: 0,
        attackdamage: 69,
        attackdamageperlevel: 4.5,
        attackspeedperlevel: 3.65,
        attackspeed: 0.625,
      },
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

const mockItemList: DDragonItemListResponse = {
  type: "item",
  version: "16.17.1",
  data: {
    "1001": {
      name: "Boots",
      description:
        "<mainText><stats><attention>25</attention> Move Speed</stats></mainText>",
      plaintext: "Slightly increases Move Speed",
      into: ["3006"],
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
    "3115": {
      name: "Nashor's Tooth",
      description:
        "<mainText><stats><attention>80</attention> Ability Power<br><attention>50%</attention> Attack Speed<br><attention>15</attention> Ability Haste</stats></mainText>",
      plaintext: "Increases Attack Speed and Ability Power",
      from: ["1043"],
      depth: 3,
      image: {
        full: "3115.png",
        sprite: "item0.png",
        group: "item",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
      },
      gold: { base: 500, purchasable: true, total: 2900, sell: 2030 },
      tags: ["AttackSpeed", "SpellDamage"],
      stats: { FlatMagicDamageMod: 80, PercentAttackSpeedMod: 0.5 },
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
    const itemService = new ItemService(ddragonClient);
    app = await buildApp({ cache, ddragonClient, championService, itemService });
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

  it("GET /api/champions/:id/scaling returns base and perLevel", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockChampionList));

    const res = await app.inject({
      method: "GET",
      url: "/api/champions/Ahri/scaling?version=16.17.1",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe("Ahri");
    expect(body.base.hp).toBe(590);
    expect(body.perLevel.hp).toBe(104);
    expect(body.levelRange).toEqual({ min: 1, max: 20 });
    expect(body.imageUrl).toContain("/cdn/16.17.1/img/champion/Ahri.png");
  });

  it("GET /api/champions/:id/scaling returns 404 for unknown id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockChampionList));

    const res = await app.inject({
      method: "GET",
      url: "/api/champions/Nope/scaling?version=16.17.1",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: "Champion 'Nope' not found",
      statusCode: 404,
    });
  });

  it("GET /api/items returns normalized list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockItemList));

    const res = await app.inject({
      method: "GET",
      url: "/api/items?version=16.17.1",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe("16.17.1");
    expect(body.count).toBe(2);
    expect(body.items.map((i: { id: string }) => i.id).sort()).toEqual([
      "1001",
      "3115",
    ]);
  });

  it("GET /api/items filters by q and purchasable", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockItemList));

    const res = await app.inject({
      method: "GET",
      url: "/api/items?version=16.17.1&q=nashor&purchasable=true",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(1);
    expect(body.items[0].id).toBe("3115");
    expect(body.items[0].stats.abilityHaste).toBe(15);
  });

  it("GET /api/items/:id returns item detail", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockItemList));

    const res = await app.inject({
      method: "GET",
      url: "/api/items/3115?version=16.17.1",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe("3115");
    expect(body.stats.abilityPower).toBe(80);
    expect(body.stats.abilityHaste).toBe(15);
    expect(body.percentBonuses.attackSpeed).toBe(0.5);
    expect(body.descriptionText).not.toMatch(/<[^>]+>/);
    expect(body.imageUrl).toContain("/cdn/16.17.1/img/item/3115.png");
  });

  it("GET /api/items/:id returns 404 for unknown id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(mockItemList));

    const res = await app.inject({
      method: "GET",
      url: "/api/items/0000?version=16.17.1",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: "Item '0000' not found",
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
      getItemList: vi.fn(),
      getLatestVersion: vi.fn(),
      imageUrl: vi.fn(),
      itemImageUrl: vi.fn(),
    } as unknown as DDragonClient;

    const isolated = await buildApp({
      cache,
      ddragonClient: failingClient,
      championService: new ChampionService(failingClient),
      itemService: new ItemService(failingClient),
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
