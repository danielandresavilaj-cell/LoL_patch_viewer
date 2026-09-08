import { describe, it, expect } from "vitest";
import {
  stripHtml,
  mapDDragonItemStats,
  enrichStatsFromDescription,
  normalizeItemStats,
  ItemService,
} from "../src/services/itemService.js";
import { DDragonClient } from "../src/services/ddragonClient.js";
import { MemoryCache } from "../src/cache/memoryCache.js";
import type { DDragonItemListResponse } from "../src/types/ddragon.js";
import { vi } from "vitest";

const mockItemList: DDragonItemListResponse = {
  type: "item",
  version: "16.17.1",
  data: {
    "1001": {
      name: "Boots",
      description:
        "<mainText><stats><attention>25</attention> Move Speed</stats><br><br></mainText>",
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
    "3031": {
      name: "Infinity Edge",
      description:
        "<mainText><stats><attention>75</attention> Attack Damage<br><attention>25%</attention> Critical Strike Chance<br><attention>30%</attention> Critical Strike Damage</stats><br><br></mainText>",
      plaintext: "Massively enhances critical strikes",
      from: ["1038", "1037", "1018"],
      into: [],
      depth: 2,
      image: {
        full: "3031.png",
        sprite: "item0.png",
        group: "item",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
      },
      gold: { base: 725, purchasable: true, total: 3500, sell: 2450 },
      tags: ["Damage", "CriticalStrike"],
      stats: { FlatCritChanceMod: 0.25, FlatPhysicalDamageMod: 75 },
    },
    "3115": {
      name: "Nashor's Tooth",
      description:
        "<mainText><stats><attention>80</attention> Ability Power<br><attention>50%</attention> Attack Speed<br><attention>15</attention> Ability Haste</stats><br><br><passive>Icathian Bite</passive></mainText>",
      plaintext: "Increases Attack Speed and Ability Power",
      from: ["1043", "1026", "3108"],
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
      tags: ["AttackSpeed", "OnHit", "SpellDamage"],
      stats: { FlatMagicDamageMod: 80, PercentAttackSpeedMod: 0.5 },
    },
    "3020": {
      name: "Sorcerer's Shoes",
      description:
        "<mainText><stats><attention>12</attention> Magic Penetration<br><attention>45</attention> Move Speed</stats><br><br></mainText>",
      plaintext: "Enhances magic damage",
      from: ["1001"],
      depth: 2,
      image: {
        full: "3020.png",
        sprite: "item0.png",
        group: "item",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
      },
      gold: { base: 800, purchasable: true, total: 1100, sell: 770 },
      tags: ["Boots", "MagicPenetration"],
      stats: { FlatMovementSpeedMod: 45 },
    },
    "9999": {
      name: "Hidden Relic",
      description: "<mainText>Not for sale</mainText>",
      plaintext: "Cannot be bought",
      image: {
        full: "9999.png",
        sprite: "item0.png",
        group: "item",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
      },
      gold: { base: 0, purchasable: false, total: 0, sell: 0 },
      tags: ["Trinket"],
      stats: {},
    },
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("stripHtml", () => {
  it("removes tags and converts br to newlines", () => {
    const html =
      "<mainText><stats><attention>15</attention> Ability Haste</stats><br><br><passive>Foo</passive></mainText>";
    const text = stripHtml(html);
    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).toContain("15");
    expect(text).toContain("Ability Haste");
    expect(text).toContain("Foo");
  });

  it("decodes common entities", () => {
    expect(stripHtml("A &amp; B&nbsp;C")).toBe("A & B C");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("mapDDragonItemStats", () => {
  it("maps flat mods to FlatStatMap", () => {
    const { stats, percentBonuses } = mapDDragonItemStats({
      FlatPhysicalDamageMod: 75,
      FlatCritChanceMod: 0.25,
      FlatHPPoolMod: 333,
    });
    expect(stats).toEqual({
      attackDamage: 75,
      crit: 0.25,
      hp: 333,
    });
    expect(percentBonuses).toEqual({});
  });

  it("maps percent mods to percentBonuses", () => {
    const { stats, percentBonuses } = mapDDragonItemStats({
      FlatMagicDamageMod: 80,
      PercentAttackSpeedMod: 0.5,
      PercentMovementSpeedMod: 0.06,
    });
    expect(stats).toEqual({ abilityPower: 80 });
    expect(percentBonuses).toEqual({
      attackSpeed: 0.5,
      moveSpeed: 0.06,
    });
  });
});

describe("enrichStatsFromDescription", () => {
  it("extracts Ability Haste and Magic Penetration missing from stats object", () => {
    const stats = { moveSpeed: 45 };
    const percentBonuses = {};
    enrichStatsFromDescription(
      "<mainText><stats><attention>12</attention> Magic Penetration<br><attention>45</attention> Move Speed<br><attention>15</attention> Ability Haste</stats></mainText>",
      stats,
      percentBonuses,
    );
    expect(stats.magicPen).toBe(12);
    expect(stats.abilityHaste).toBe(15);
    expect(stats.moveSpeed).toBe(45);
  });

  it("does not overwrite existing flat stats", () => {
    const stats = { attackDamage: 75 };
    const percentBonuses = {};
    enrichStatsFromDescription(
      "<stats><attention>99</attention> Attack Damage</stats>",
      stats,
      percentBonuses,
    );
    expect(stats.attackDamage).toBe(75);
  });
});

describe("normalizeItemStats", () => {
  it("combines object stats with description Ability Haste", () => {
    const { stats, percentBonuses } = normalizeItemStats(
      { FlatMagicDamageMod: 80, PercentAttackSpeedMod: 0.5 },
      "<stats><attention>80</attention> Ability Power<br><attention>50%</attention> Attack Speed<br><attention>15</attention> Ability Haste</stats>",
    );
    expect(stats.abilityPower).toBe(80);
    expect(stats.abilityHaste).toBe(15);
    expect(percentBonuses.attackSpeed).toBe(0.5);
  });
});

describe("ItemService", () => {
  it("lists, filters and normalizes items", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(mockItemList));
    const client = new DDragonClient({
      cache: new MemoryCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const service = new ItemService(client);

    const all = await service.listItems({ version: "16.17.1" });
    expect(all.count).toBe(5);
    expect(all.version).toBe("16.17.1");

    const boots = await service.listItems({
      version: "16.17.1",
      q: "boot",
      tags: ["Boots"],
      purchasable: true,
    });
    expect(boots.count).toBe(2);
    expect(boots.items.map((i) => i.id).sort()).toEqual(["1001", "3020"]);

    const hidden = await service.listItems({
      version: "16.17.1",
      purchasable: false,
    });
    expect(hidden.count).toBe(1);
    expect(hidden.items[0].id).toBe("9999");
  });

  it("returns item detail with stripped HTML and haste from description", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(mockItemList));
    const client = new DDragonClient({
      cache: new MemoryCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const service = new ItemService(client);

    const nashor = await service.getItemById("3115", "16.17.1");
    expect(nashor).toBeDefined();
    expect(nashor!.name).toBe("Nashor's Tooth");
    expect(nashor!.descriptionText).not.toMatch(/<[^>]+>/);
    expect(nashor!.stats.abilityPower).toBe(80);
    expect(nashor!.stats.abilityHaste).toBe(15);
    expect(nashor!.percentBonuses.attackSpeed).toBe(0.5);
    expect(nashor!.imageUrl).toContain("/cdn/16.17.1/img/item/3115.png");

    const shoes = await service.getItemById("3020", "16.17.1");
    expect(shoes!.stats.magicPen).toBe(12);
    expect(shoes!.stats.moveSpeed).toBe(45);
  });

  it("returns undefined for unknown item", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(mockItemList));
    const client = new DDragonClient({
      cache: new MemoryCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const service = new ItemService(client);
    await expect(service.getItemById("0000", "16.17.1")).resolves.toBeUndefined();
  });
});
