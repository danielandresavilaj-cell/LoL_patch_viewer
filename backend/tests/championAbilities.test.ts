import { describe, expect, it, vi } from "vitest";
import {
  ChampionService,
  detectDamageTypes,
  toAbilityKit,
} from "../src/services/championService.js";
import { DDragonClient } from "../src/services/ddragonClient.js";
import { MemoryCache } from "../src/cache/memoryCache.js";
import type {
  DDragonChampionDetailResponse,
  DDragonChampionListResponse,
} from "../src/types/ddragon.js";

const mockList: DDragonChampionListResponse = {
  type: "champion",
  format: "standAloneComplex",
  version: "16.17.1",
  data: {
    Ahri: {
      id: "Ahri",
      key: "103",
      name: "Ahri",
      title: "the Nine-Tailed Fox",
      blurb: "blurb",
      tags: ["Mage"],
      partype: "Mana",
      info: { attack: 3, defense: 4, magic: 8, difficulty: 5 },
      stats: {
        hp: 590,
        hpperlevel: 104,
        mp: 418,
        mpperlevel: 25,
        armor: 21,
        armorperlevel: 4.7,
        spellblock: 30,
        spellblockperlevel: 1.3,
        attackdamage: 53,
        attackdamageperlevel: 3,
        attackspeed: 0.668,
        attackspeedperlevel: 2,
        movespeed: 330,
        crit: 0,
        critperlevel: 0,
        hpregen: 2.5,
        hpregenperlevel: 0.6,
        mpregen: 8,
        mpregenperlevel: 0.8,
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

const mockDetail: DDragonChampionDetailResponse = {
  type: "champion",
  format: "standAloneComplex",
  version: "16.17.1",
  data: {
    Ahri: {
      ...mockList.data.Ahri,
      lore: "Ahri lore",
      passive: {
        name: "Essence Theft",
        description:
          "After killing 9 minions, Ahri <healing>heals</healing>.",
        image: {
          full: "Ahri_SoulEater2.png",
          sprite: "passive0.png",
          group: "passive",
          x: 0,
          y: 0,
          w: 48,
          h: 48,
        },
      },
      spells: [
        {
          id: "AhriQ",
          name: "Orb of Deception",
          description:
            "Ahri sends out and pulls back her orb, dealing magic damage.",
          tooltip:
            "dealing <magicDamage>{{ totaldamage }} magic damage</magicDamage> and <trueDamage>{{ totaldamage }} true damage</trueDamage>",
          maxrank: 5,
          cooldown: [7, 7, 7, 7, 7],
          cooldownBurn: "7",
          cost: [55, 65, 75, 85, 95],
          costBurn: "55/65/75/85/95",
          costType: " {{ abilityresourcename }}",
          rangeBurn: "970",
          image: {
            full: "AhriQ.png",
            sprite: "spell0.png",
            group: "spell",
            x: 0,
            y: 0,
            w: 48,
            h: 48,
          },
        },
        {
          id: "AhriW",
          name: "Fox-Fire",
          description: "Ahri releases fox-fires.",
          tooltip: "<magicDamage>{{ damage }} magic damage</magicDamage>",
          maxrank: 5,
          cooldown: [9, 8, 7, 6, 5],
          cooldownBurn: "9/8/7/6/5",
          cost: [30, 30, 30, 30, 30],
          costBurn: "30",
          rangeBurn: "700",
          image: {
            full: "AhriW.png",
            sprite: "spell0.png",
            group: "spell",
            x: 48,
            y: 0,
            w: 48,
            h: 48,
          },
        },
        {
          id: "AhriE",
          name: "Charm",
          description: "Ahri blows a kiss.",
          tooltip: "<magicDamage>{{ damage }}</magicDamage>",
          maxrank: 5,
          cooldown: [12, 12, 12, 12, 12],
          cooldownBurn: "12",
          cost: [60, 60, 60, 60, 60],
          costBurn: "60",
          rangeBurn: "975",
          image: {
            full: "AhriE.png",
            sprite: "spell0.png",
            group: "spell",
            x: 96,
            y: 0,
            w: 48,
            h: 48,
          },
        },
        {
          id: "AhriR",
          name: "Spirit Rush",
          description: "Ahri dashes.",
          tooltip: "<magicDamage>{{ damage }}</magicDamage>",
          maxrank: 3,
          cooldown: [130, 105, 80],
          cooldownBurn: "130/105/80",
          cost: [100, 100, 100],
          costBurn: "100",
          rangeBurn: "450",
          image: {
            full: "AhriR.png",
            sprite: "spell0.png",
            group: "spell",
            x: 144,
            y: 0,
            w: 48,
            h: 48,
          },
        },
      ],
    },
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("detectDamageTypes", () => {
  it("detects magic and true from tooltip tags", () => {
    expect(
      detectDamageTypes(
        "<magicDamage>x</magicDamage> <trueDamage>y</trueDamage>",
        "",
      ),
    ).toEqual(["magic", "true"]);
  });
});

describe("toAbilityKit", () => {
  it("builds P+QWER kit with stripped HTML and CDN urls", () => {
    const client = {
      spellImageUrl: (v: string, f: string) => `spell/${v}/${f}`,
      passiveImageUrl: (v: string, f: string) => `passive/${v}/${f}`,
    };
    const kit = toAbilityKit(mockDetail.data.Ahri, "16.17.1", client);
    expect(kit.abilities).toHaveLength(5);
    expect(kit.passive.slot).toBe("P");
    expect(kit.spells.map((s) => s.slot)).toEqual(["Q", "W", "E", "R"]);
    expect(kit.spells[0].description).not.toMatch(/<[^>]+>/);
    expect(kit.spells[0].damageTypes).toEqual(["magic", "true"]);
    expect(kit.spells[0].cooldowns).toEqual([7, 7, 7, 7, 7]);
    expect(kit.passive.imageUrl).toContain("passive/");
  });
});

describe("ChampionService.getChampionAbilities", () => {
  it("returns kit for known champion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockList))
      .mockResolvedValueOnce(jsonResponse(mockDetail));

    const client = new DDragonClient({
      cache: new MemoryCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const service = new ChampionService(client);
    const kit = await service.getChampionAbilities("Ahri", "16.17.1");
    expect(kit).toBeDefined();
    expect(kit!.championId).toBe("Ahri");
    expect(kit!.spells[0].name).toBe("Orb of Deception");
    expect(kit!.spells[0].imageUrl).toContain("/img/spell/AhriQ.png");
  });

  it("returns undefined for unknown champion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(mockList));
    const client = new DDragonClient({
      cache: new MemoryCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const service = new ChampionService(client);
    await expect(
      service.getChampionAbilities("Nope", "16.17.1"),
    ).resolves.toBeUndefined();
  });
});
