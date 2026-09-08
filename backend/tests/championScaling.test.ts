import { describe, it, expect } from "vitest";
import {
  toScalingProfile,
  DEFAULT_LEVEL_RANGE,
  ChampionService,
} from "../src/services/championService.js";
import { DDragonClient } from "../src/services/ddragonClient.js";
import { MemoryCache } from "../src/cache/memoryCache.js";
import type { DDragonChampionListResponse } from "../src/types/ddragon.js";
import { vi } from "vitest";

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
        attackrange: 550,
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
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("toScalingProfile", () => {
  it("maps base and perLevel stats with levelRange 1-20", () => {
    const profile = toScalingProfile(
      mockChampionList.data.Ahri,
      "16.17.1",
      "https://ddragon.leagueoflegends.com/cdn/16.17.1/img/champion/Ahri.png",
    );

    expect(profile.id).toBe("Ahri");
    expect(profile.levelRange).toEqual(DEFAULT_LEVEL_RANGE);
    expect(profile.base).toMatchObject({
      hp: 590,
      mp: 418,
      armor: 21,
      spellBlock: 30,
      attackDamage: 53,
      attackSpeed: 0.668,
      moveSpeed: 330,
      crit: 0,
      hpRegen: 2.5,
      mpRegen: 8,
    });
    expect(profile.perLevel).toMatchObject({
      hp: 104,
      mp: 25,
      armor: 4.2,
      spellBlock: 1.3,
      attackDamage: 0,
      attackSpeed: 2.2,
      crit: 0,
      hpRegen: 0.6,
      mpRegen: 0.8,
    });
  });
});

describe("ChampionService.getChampionScaling", () => {
  it("returns scaling profile for known champion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(mockChampionList));
    const client = new DDragonClient({
      cache: new MemoryCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const service = new ChampionService(client);
    const profile = await service.getChampionScaling("ahri", "16.17.1");
    expect(profile?.id).toBe("Ahri");
    expect(profile?.base.hp).toBe(590);
    expect(profile?.levelRange.max).toBe(20);
  });

  it("returns undefined for unknown champion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(mockChampionList));
    const client = new DDragonClient({
      cache: new MemoryCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const service = new ChampionService(client);
    await expect(
      service.getChampionScaling("NotAChamp", "16.17.1"),
    ).resolves.toBeUndefined();
  });
});
