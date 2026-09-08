import type {
  ChampionListResult,
  ChampionSummary,
  DDragonChampionDetailRaw,
  DDragonChampionPassiveRaw,
  DDragonChampionRaw,
  DDragonChampionSpellRaw,
} from "../types/ddragon.js";
import type {
  AbilityDamageType,
  AbilitySlot,
  ChampionAbility,
  ChampionAbilityKit,
  ChampionScalingProfile,
  FlatStatMap,
} from "../types/build.js";
import { DDragonClient } from "./ddragonClient.js";
import { stripHtml } from "./itemService.js";

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

const SPELL_SLOTS: AbilitySlot[] = ["Q", "W", "E", "R"];

const DAMAGE_TAG_MAP: Array<{ tag: RegExp; type: AbilityDamageType }> = [
  { tag: /physicalDamage/i, type: "physical" },
  { tag: /magicDamage/i, type: "magic" },
  { tag: /trueDamage/i, type: "true" },
  { tag: /<(?:healing|heal)\b/i, type: "heal" },
  { tag: /shield/i, type: "shield" },
];

export function detectDamageTypes(
  tooltip: string,
  description: string,
): AbilityDamageType[] {
  const haystack = `${tooltip}\n${description}`;
  const found: AbilityDamageType[] = [];
  for (const { tag, type } of DAMAGE_TAG_MAP) {
    if (tag.test(haystack) && !found.includes(type)) {
      found.push(type);
    }
  }
  return found.length > 0 ? found : ["unknown"];
}

export function toAbilityFromPassive(
  passive: DDragonChampionPassiveRaw,
  _version: string,
  imageUrl: string,
): ChampionAbility {
  return {
    slot: "P",
    id: "passive",
    name: passive.name,
    description: stripHtml(passive.description ?? ""),
    maxRank: 1,
    cooldowns: [],
    cooldownBurn: "",
    costs: [],
    costBurn: "",
    costType: "",
    rangeBurn: "",
    imageUrl,
    damageTypes: detectDamageTypes("", passive.description ?? ""),
  };
}

export function toAbilityFromSpell(
  spell: DDragonChampionSpellRaw,
  slot: AbilitySlot,
  _version: string,
  imageUrl: string,
): ChampionAbility {
  return {
    slot,
    id: spell.id,
    name: spell.name,
    description: stripHtml(spell.description ?? ""),
    maxRank: spell.maxrank ?? spell.cooldown?.length ?? 5,
    cooldowns: Array.isArray(spell.cooldown) ? spell.cooldown : [],
    cooldownBurn: spell.cooldownBurn ?? "",
    costs: Array.isArray(spell.cost) ? spell.cost : [],
    costBurn: spell.costBurn ?? "",
    costType: spell.costType ?? spell.resource ?? "",
    rangeBurn: spell.rangeBurn ?? "",
    imageUrl,
    damageTypes: detectDamageTypes(
      spell.tooltip ?? "",
      spell.description ?? "",
    ),
  };
}

export function toAbilityKit(
  champion: DDragonChampionDetailRaw,
  version: string,
  client: Pick<DDragonClient, "spellImageUrl" | "passiveImageUrl">,
): ChampionAbilityKit {
  const passive = toAbilityFromPassive(
    champion.passive,
    version,
    client.passiveImageUrl(version, champion.passive.image.full),
  );

  const spells = (champion.spells ?? []).slice(0, 4).map((spell, index) =>
    toAbilityFromSpell(
      spell,
      SPELL_SLOTS[index] ?? "Q",
      version,
      client.spellImageUrl(version, spell.image.full),
    ),
  );

  return {
    championId: champion.id,
    name: champion.name,
    version,
    passive,
    spells,
    abilities: [passive, ...spells],
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

  async getChampionAbilities(
    id: string,
    version?: string,
  ): Promise<ChampionAbilityKit | undefined> {
    const listEntry = await this.findChampion(id, version);
    if (!listEntry) return undefined;

    try {
      const detail = await this.client.getChampionDetail(
        listEntry.champion.id,
        listEntry.version,
      );
      return toAbilityKit(detail.champion, detail.version, this.client);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "statusCode" in err &&
        (err as { statusCode: number }).statusCode === 404
      ) {
        return undefined;
      }
      throw err;
    }
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
