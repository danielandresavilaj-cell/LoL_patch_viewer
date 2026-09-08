import type {
  ChampionListResult,
  ChampionSummary,
  DDragonChampionRaw,
} from "../types/ddragon.js";
import type { ChampionScalingProfile, FlatStatMap } from "../types/build.js";
import { DDragonClient } from "./ddragonClient.js";

export const DEFAULT_LEVEL_RANGE = { min: 1, max: 20 } as const;

export interface ListChampionsQuery {
  q?: string;
  tags?: string[];
  version?: string;
}

function num(stats: Record<string, number>, key: string, fallback = 0): number {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function toScalingProfile(
  champion: DDragonChampionRaw,
  version: string,
  imageUrl: string,
): ChampionScalingProfile {
  const s = champion.stats ?? {};

  const base: ChampionScalingProfile["base"] = {
    hp: num(s, "hp"),
    mp: num(s, "mp"),
    armor: num(s, "armor"),
    spellBlock: num(s, "spellblock"),
    attackDamage: num(s, "attackdamage"),
    attackSpeed: num(s, "attackspeed"),
    moveSpeed: num(s, "movespeed"),
    crit: num(s, "crit"),
    hpRegen: num(s, "hpregen"),
    mpRegen: num(s, "mpregen"),
  };

  const perLevel: FlatStatMap = {};
  const perLevelPairs: Array<[keyof FlatStatMap, string]> = [
    ["hp", "hpperlevel"],
    ["mp", "mpperlevel"],
    ["armor", "armorperlevel"],
    ["spellBlock", "spellblockperlevel"],
    ["attackDamage", "attackdamageperlevel"],
    ["attackSpeed", "attackspeedperlevel"],
    ["crit", "critperlevel"],
    ["hpRegen", "hpregenperlevel"],
    ["mpRegen", "mpregenperlevel"],
  ];

  for (const [key, rawKey] of perLevelPairs) {
    if (rawKey in s) {
      perLevel[key] = num(s, rawKey);
    }
  }

  return {
    id: champion.id,
    name: champion.name,
    version,
    imageUrl,
    base,
    perLevel,
    levelRange: { ...DEFAULT_LEVEL_RANGE },
  };
}

export class ChampionService {
  constructor(private readonly client: DDragonClient) {}

  async listChampions(query: ListChampionsQuery = {}): Promise<ChampionListResult> {
    const raw = await this.client.getChampionList(query.version);
    const version = raw.version;

    let champions = Object.values(raw.data).map((c) =>
      this.toSummary(c, version),
    );

    const q = query.q?.trim().toLowerCase();
    if (q) {
      champions = champions.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q),
      );
    }

    if (query.tags && query.tags.length > 0) {
      const wanted = query.tags.map((t) => t.toLowerCase());
      champions = champions.filter((c) =>
        c.tags.some((tag) => wanted.includes(tag.toLowerCase())),
      );
    }

    champions.sort((a, b) => a.name.localeCompare(b.name));

    return {
      version,
      count: champions.length,
      champions,
    };
  }

  async getChampionById(
    id: string,
    version?: string,
  ): Promise<ChampionSummary | undefined> {
    const entry = await this.findChampion(id, version);
    if (!entry) return undefined;
    return this.toSummary(entry.champion, entry.version);
  }

  async getChampionScaling(
    id: string,
    version?: string,
  ): Promise<ChampionScalingProfile | undefined> {
    const entry = await this.findChampion(id, version);
    if (!entry) return undefined;
    return toScalingProfile(
      entry.champion,
      entry.version,
      this.client.imageUrl(entry.version, entry.champion.image.full),
    );
  }

  private async findChampion(
    id: string,
    version?: string,
  ): Promise<{ champion: DDragonChampionRaw; version: string } | undefined> {
    const raw = await this.client.getChampionList(version);
    const entry =
      raw.data[id] ??
      Object.values(raw.data).find(
        (c) => c.id.toLowerCase() === id.toLowerCase(),
      );
    if (!entry) return undefined;
    return { champion: entry, version: raw.version };
  }

  private toSummary(
    champion: DDragonChampionRaw,
    version: string,
  ): ChampionSummary {
    return {
      id: champion.id,
      key: champion.key,
      name: champion.name,
      title: champion.title,
      blurb: champion.blurb,
      tags: champion.tags,
      partype: champion.partype,
      info: champion.info,
      stats: champion.stats,
      imageUrl: this.client.imageUrl(version, champion.image.full),
      version,
    };
  }
}
