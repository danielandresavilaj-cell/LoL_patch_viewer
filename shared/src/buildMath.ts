import type {
  BuildComputedStats,
  ChampionScalingInput,
  ComputeBuildInput,
  FlatStatKey,
  FlatStatMap,
} from "./types.js";

/** Factor de crecimiento no lineal de Riot para (level − 1). */
export function growthFactor(level: number): number {
  const steps = level - 1;
  return steps * (0.7025 + 0.0175 * steps);
}

/**
 * Stat en un nivel dado:
 * Base + Growth × (Level−1) × (0.7025 + 0.0175 × (Level−1))
 */
export function statAtLevel(
  base: number,
  growth: number,
  level: number,
): number {
  return base + growth * growthFactor(level);
}

const ALL_KEYS: FlatStatKey[] = [
  "hp",
  "mp",
  "armor",
  "spellBlock",
  "attackDamage",
  "abilityPower",
  "attackSpeed",
  "moveSpeed",
  "crit",
  "hpRegen",
  "mpRegen",
  "armorPen",
  "magicPen",
  "lifesteal",
  "spellVamp",
  "abilityHaste",
];

function clampLevel(
  level: number,
  range: { min: number; max: number } = { min: 1, max: 20 },
): number {
  if (!Number.isFinite(level)) {
    return range.min;
  }
  return Math.min(range.max, Math.max(range.min, Math.trunc(level)));
}

/** Stats del campeón a un nivel, aplicando la curva a cada clave con growth. */
export function statsAtLevel(
  base: FlatStatMap,
  perLevel: FlatStatMap,
  level: number,
): FlatStatMap {
  const result: FlatStatMap = {};
  const keys = new Set<FlatStatKey>([
    ...(Object.keys(base) as FlatStatKey[]),
    ...(Object.keys(perLevel) as FlatStatKey[]),
  ]);

  for (const key of keys) {
    const b = base[key] ?? 0;
    const g = perLevel[key] ?? 0;
    if (b === 0 && g === 0) {
      continue;
    }
    result[key] = statAtLevel(b, g, level);
  }

  return result;
}

/** Suma elemento a elemento de mapas de stats planos. */
export function sumFlatStats(...maps: FlatStatMap[]): FlatStatMap {
  const result: FlatStatMap = {};

  for (const map of maps) {
    for (const key of ALL_KEYS) {
      const value = map[key];
      if (value === undefined || value === 0) {
        continue;
      }
      result[key] = (result[key] ?? 0) + value;
    }
  }

  return result;
}

/**
 * CDR desde Ability Haste:
 * ratio = AH / (AH + 100), percent = ratio × 100
 */
export function abilityHasteToCdr(abilityHaste: number): {
  ratio: number;
  percent: number;
} {
  const ah = Number.isFinite(abilityHaste) ? Math.max(0, abilityHaste) : 0;
  if (ah === 0) {
    return { ratio: 0, percent: 0 };
  }
  const ratio = ah / (ah + 100);
  return {
    ratio,
    percent: ratio * 100,
  };
}

/**
 * Enfriamiento efectivo con Ability Haste:
 * baseCd × 100 / (100 + AH)  ≡  baseCd × (1 − AH/(AH+100))
 */
export function cooldownWithAbilityHaste(
  baseCooldown: number,
  abilityHaste: number,
): number {
  if (!Number.isFinite(baseCooldown) || baseCooldown <= 0) {
    return 0;
  }
  const ah = Number.isFinite(abilityHaste) ? Math.max(0, abilityHaste) : 0;
  return baseCooldown * (100 / (100 + ah));
}

export function computeBuildStats(input: ComputeBuildInput): BuildComputedStats {
  const { profile, itemStats } = input;
  const level = clampLevel(input.level, profile.levelRange ?? { min: 1, max: 20 });
  const fromLevel = statsAtLevel(profile.base, profile.perLevel, level);
  const fromItems = sumFlatStats(...itemStats);
  const total = sumFlatStats(fromLevel, fromItems);
  const abilityHaste = total.abilityHaste ?? 0;
  const cooldownReduction = abilityHasteToCdr(abilityHaste);
  const itemIds =
    input.itemIds ??
    itemStats.map((_, index) => `slot-${index}`);

  return {
    level,
    championId: profile.id,
    itemIds,
    fromLevel,
    fromItems,
    total,
    abilityHaste,
    cooldownReduction,
  };
}

/** Helper tipado para fixtures / callers. */
export function emptyProfile(
  id: string,
  base: FlatStatMap = {},
  perLevel: FlatStatMap = {},
): ChampionScalingInput {
  return {
    id,
    base,
    perLevel,
    levelRange: { min: 1, max: 20 },
  };
}
