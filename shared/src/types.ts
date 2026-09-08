/** Claves de combate que la calculadora v1 agrega de forma explícita. */
export type FlatStatKey =
  | "hp"
  | "mp"
  | "armor"
  | "spellBlock"
  | "attackDamage"
  | "abilityPower"
  | "attackSpeed"
  | "moveSpeed"
  | "crit"
  | "hpRegen"
  | "mpRegen"
  | "armorPen"
  | "magicPen"
  | "lifesteal"
  | "spellVamp"
  | "abilityHaste";

export type FlatStatMap = Partial<Record<FlatStatKey, number>>;

/** Perfil mínimo que necesita el motor (sin dependencias de HTTP). */
export interface ChampionScalingInput {
  id: string;
  base: FlatStatMap;
  perLevel: FlatStatMap;
  levelRange?: { min: number; max: number };
}

export interface BuildComputedStats {
  level: number;
  championId: string;
  itemIds: string[];
  fromLevel: FlatStatMap;
  fromItems: FlatStatMap;
  total: FlatStatMap;
  abilityHaste: number;
  cooldownReduction: {
    ratio: number;
    percent: number;
  };
}

export interface ComputeBuildInput {
  profile: ChampionScalingInput;
  level: number;
  /** Stats planos de cada ítem equipado (hasta 6 en la UI). */
  itemStats: FlatStatMap[];
  /** IDs opcionales para trazabilidad en el DTO de salida. */
  itemIds?: string[];
}
