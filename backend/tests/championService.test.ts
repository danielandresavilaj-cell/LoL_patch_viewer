import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChampionService } from "../src/services/championService.js";
import { DDragonClient } from "../src/services/ddragonClient.js";
import { MemoryCache } from "../src/cache/memoryCache.js";
import type { DDragonChampionListResponse } from "../src/types/ddragon.js";

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
    Lux: {
      id: "Lux",
      key: "99",
      name: "Lux",
      title: "the Lady of Luminosity",
      blurb: "Demacian mage.",
      tags: ["Mage", "Support"],
      partype: "Mana",
      info: { attack: 2, defense: 4, magic: 9, difficulty: 5 },
      stats: { hp: 560, mp: 480, movespeed: 330 },
      image: {
        full: "Lux.png",
        sprite: "champion1.png",
        group: "champion",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
      },
    },
  },
};

describe("ChampionService", () => {
  let service: ChampionService;

  beforeEach(() => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockChampionList), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new DDragonClient({
      cache: new MemoryCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    service = new ChampionService(client);
  });

  it("normalizes champion list to DTOs with image URLs", async () => {
    const result = await service.listChampions({ version: "16.17.1" });
    expect(result.version).toBe("16.17.1");
    expect(result.count).toBe(3);
    expect(result.champions.map((c) => c.name)).toEqual([
      "Ahri",
      "Garen",
      "Lux",
    ]);
    expect(result.champions[0].imageUrl).toContain(
      "/cdn/16.17.1/img/champion/Ahri.png",
    );
  });

  it("filters by name query (case-insensitive)", async () => {
    const result = await service.listChampions({
      version: "16.17.1",
      q: "lux",
    });
    expect(result.count).toBe(1);
    expect(result.champions[0].id).toBe("Lux");
  });

  it("filters by tags", async () => {
    const result = await service.listChampions({
      version: "16.17.1",
      tags: ["Mage"],
    });
    expect(result.champions.map((c) => c.id).sort()).toEqual(["Ahri", "Lux"]);
  });

  it("combines query and tags", async () => {
    const result = await service.listChampions({
      version: "16.17.1",
      q: "a",
      tags: ["Assassin"],
    });
    expect(result.count).toBe(1);
    expect(result.champions[0].id).toBe("Ahri");
  });

  it("gets champion by id", async () => {
    const champ = await service.getChampionById("Garen", "16.17.1");
    expect(champ?.name).toBe("Garen");
    expect(champ?.tags).toContain("Tank");
  });

  it("returns undefined for unknown champion", async () => {
    const champ = await service.getChampionById("NotAChamp", "16.17.1");
    expect(champ).toBeUndefined();
  });
});
