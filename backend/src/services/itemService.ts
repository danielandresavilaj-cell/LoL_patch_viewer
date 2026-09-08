import type {
  FlatStatKey,
  FlatStatMap,
  ItemListResult,
  ItemSummary,
} from "../types/build.js";
import type { DDragonItemRaw } from "../types/ddragon.js";
import { DDragonClient } from "./ddragonClient.js";

/** Data Dragon flat / percent keys → our FlatStatKey. */
const FLAT_STAT_KEY_MAP: Record<string, FlatStatKey> = {
  FlatHPPoolMod: "hp",
  FlatMPPoolMod: "mp",
  FlatArmorMod: "armor",
  FlatSpellBlockMod: "spellBlock",
  FlatPhysicalDamageMod: "attackDamage",
  FlatMagicDamageMod: "abilityPower",
  FlatAttackSpeedMod: "attackSpeed",
  FlatMovementSpeedMod: "moveSpeed",
  FlatCritChanceMod: "crit",
  FlatHPRegenMod: "hpRegen",
  FlatMPRegenMod: "mpRegen",
  FlatArmorPenetrationMod: "armorPen",
  rFlatArmorPenetrationMod: "armorPen",
  FlatMagicPenetrationMod: "magicPen",
  rFlatMagicPenetrationMod: "magicPen",
  FlatAbilityHasteMod: "abilityHaste",
  PercentLifeStealMod: "lifesteal",
  PercentSpellVampMod: "spellVamp",
};

const PERCENT_STAT_KEY_MAP: Record<string, FlatStatKey> = {
  PercentAttackSpeedMod: "attackSpeed",
  PercentMovementSpeedMod: "moveSpeed",
  PercentHPPoolMod: "hp",
  PercentArmorMod: "armor",
  PercentSpellBlockMod: "spellBlock",
  PercentArmorPenetrationMod: "armorPen",
  PercentMagicPenetrationMod: "magicPen",
  PercentLifeStealMod: "lifesteal",
  PercentSpellVampMod: "spellVamp",
};

/** Labels inside `<stats>` blocks (en_US Data Dragon). */
const DESCRIPTION_LABEL_MAP: Record<
  string,
  { key: FlatStatKey; percent?: boolean }
> = {
  "attack damage": { key: "attackDamage" },
  "ability power": { key: "abilityPower" },
  health: { key: "hp" },
  mana: { key: "mp" },
  armor: { key: "armor" },
  "magic resist": { key: "spellBlock" },
  "magic resistance": { key: "spellBlock" },
  "attack speed": { key: "attackSpeed", percent: true },
  "move speed": { key: "moveSpeed" },
  "movement speed": { key: "moveSpeed" },
  "critical strike chance": { key: "crit", percent: true },
  "ability haste": { key: "abilityHaste" },
  "magic penetration": { key: "magicPen" },
  "armor penetration": { key: "armorPen" },
  "life steal": { key: "lifesteal", percent: true },
  lifesteal: { key: "lifesteal", percent: true },
  "spell vamp": { key: "spellVamp", percent: true },
  omnivamp: { key: "spellVamp", percent: true },
  "base health regen": { key: "hpRegen" },
  "health regen": { key: "hpRegen" },
  "base mana regen": { key: "mpRegen" },
  "mana regen": { key: "mpRegen" },
};

export interface ListItemsQuery {
  q?: string;
  tags?: string[];
  purchasable?: boolean;
  version?: string;
}

/** Remove HTML tags and decode a few common entities. */
export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:mainText|stats|passive|active|attention|scaleAP|scaleAD|scaleArmor|scaleMR|scaleHealth|magicDamage|physicalDamage|keywordMajor|rules)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function setStat(map: FlatStatMap, key: FlatStatKey, value: number): void {
  if (!Number.isFinite(value)) return;
  map[key] = (map[key] ?? 0) + value;
}

/**
 * Map Data Dragon `stats` object into flat vs percent maps.
 * PercentLifeStealMod is treated as percent (not flat).
 */
export function mapDDragonItemStats(rawStats: Record<string, number>): {
  stats: FlatStatMap;
  percentBonuses: FlatStatMap;
} {
  const stats: FlatStatMap = {};
  const percentBonuses: FlatStatMap = {};

  for (const [rawKey, value] of Object.entries(rawStats ?? {})) {
    if (rawKey.startsWith("Percent") || rawKey in PERCENT_STAT_KEY_MAP) {
      const key =
        PERCENT_STAT_KEY_MAP[rawKey] ??
        FLAT_STAT_KEY_MAP[rawKey.replace(/^Percent/, "Flat")];
      if (key) setStat(percentBonuses, key, value);
      continue;
    }
    const key = FLAT_STAT_KEY_MAP[rawKey];
    if (key) setStat(stats, key, value);
  }

  // PercentLifeStealMod is both "Percent*" and in FLAT map historically — prefer percent.
  if ("PercentLifeStealMod" in (rawStats ?? {})) {
    delete stats.lifesteal;
    percentBonuses.lifesteal = rawStats.PercentLifeStealMod;
  }

  return { stats, percentBonuses };
}

/**
 * Parse `<stats>...</stats>` for values missing from the numeric stats object
 * (notably Ability Haste and flat Magic Penetration).
 */
export function enrichStatsFromDescription(
  description: string,
  stats: FlatStatMap,
  percentBonuses: FlatStatMap,
): void {
  const match = description.match(/<stats>([\s\S]*?)<\/stats>/i);
  if (!match) return;

  const block = match[1];
  const parts = block.split(/<br\s*\/?>/i);

  for (const part of parts) {
    const cleaned = part.replace(/<\/?attention>/gi, "").replace(/<[^>]+>/g, "").trim();
    if (!cleaned) continue;

    const m = cleaned.match(/^([\d.]+)\s*(%?)\s+(.+)$/i);
    if (!m) continue;

    const numeric = Number(m[1]);
    if (!Number.isFinite(numeric)) continue;
    const hasPercent = m[2] === "%";
    const label = m[3].trim().toLowerCase();
    const mapped = DESCRIPTION_LABEL_MAP[label];
    if (!mapped) continue;

    const isPercent = hasPercent || mapped.percent === true;
    // Description percentages are shown as 25% → store 0.25 to match FlatCritChanceMod.
    const normalized =
      isPercent && (hasPercent || numeric > 1) ? numeric / 100 : numeric;

    if (
      mapped.key === "abilityHaste" ||
      mapped.key === "magicPen" ||
      mapped.key === "armorPen"
    ) {
      // Prefer description for these when DD omits them from stats.
      if (stats[mapped.key] === undefined) {
        stats[mapped.key] = normalized;
      }
      continue;
    }

    if (isPercent) {
      if (percentBonuses[mapped.key] === undefined) {
        percentBonuses[mapped.key] = normalized;
      }
    } else if (stats[mapped.key] === undefined) {
      stats[mapped.key] = normalized;
    }
  }
}

export function normalizeItemStats(
  rawStats: Record<string, number>,
  description: string,
): { stats: FlatStatMap; percentBonuses: FlatStatMap } {
  const { stats, percentBonuses } = mapDDragonItemStats(rawStats);
  enrichStatsFromDescription(description, stats, percentBonuses);
  return { stats, percentBonuses };
}

export class ItemService {
  constructor(private readonly client: DDragonClient) {}

  async listItems(query: ListItemsQuery = {}): Promise<ItemListResult> {
    const raw = await this.client.getItemList(query.version);
    const version = raw.version;

    let items = Object.entries(raw.data).map(([id, item]) =>
      this.toSummary(id, item, version),
    );

    if (query.purchasable === true) {
      items = items.filter((i) => i.gold.purchasable);
    } else if (query.purchasable === false) {
      items = items.filter((i) => !i.gold.purchasable);
    }

    const q = query.q?.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.id.includes(q) ||
          i.plaintext.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (query.tags && query.tags.length > 0) {
      const wanted = query.tags.map((t) => t.toLowerCase());
      items = items.filter((i) =>
        i.tags.some((tag) => wanted.includes(tag.toLowerCase())),
      );
    }

    items.sort((a, b) => a.name.localeCompare(b.name));

    return {
      version,
      count: items.length,
      items,
    };
  }

  async getItemById(
    id: string,
    version?: string,
  ): Promise<ItemSummary | undefined> {
    const raw = await this.client.getItemList(version);
    const entry =
      raw.data[id] ??
      Object.entries(raw.data).find(([key]) => key === id)?.[1];
    if (!entry) {
      // case-insensitive id lookup
      const found = Object.entries(raw.data).find(
        ([key]) => key.toLowerCase() === id.toLowerCase(),
      );
      if (!found) return undefined;
      return this.toSummary(found[0], found[1], raw.version);
    }
    return this.toSummary(id, entry, raw.version);
  }

  private toSummary(
    id: string,
    item: DDragonItemRaw,
    version: string,
  ): ItemSummary {
    const { stats, percentBonuses } = normalizeItemStats(
      item.stats ?? {},
      item.description ?? "",
    );

    return {
      id,
      name: item.name,
      plaintext: stripHtml(item.plaintext ?? ""),
      descriptionText: stripHtml(item.description ?? ""),
      imageUrl: this.client.itemImageUrl(version, item.image.full),
      gold: {
        base: item.gold.base,
        total: item.gold.total,
        sell: item.gold.sell,
        purchasable: item.gold.purchasable,
      },
      tags: item.tags ?? [],
      stats,
      percentBonuses,
      from: item.from ?? [],
      into: item.into ?? [],
      depth: item.depth ?? 0,
      version,
    };
  }
}
