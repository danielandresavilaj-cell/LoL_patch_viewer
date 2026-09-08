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

/** Perfil de escalado del campeón (ya normalizado; sin claves crudas de DDragon). */
export interface ChampionScalingProfile {
  id: string;
  name: string;
  version: string;
  imageUrl: string;
  /** Stats en nivel 1 (bases Data Dragon). */
  base: Required<
    Pick<
      FlatStatMap,
      | "hp"
      | "mp"
      | "armor"
      | "spellBlock"
      | "attackDamage"
      | "attackSpeed"
      | "moveSpeed"
      | "crit"
      | "hpRegen"
      | "mpRegen"
    >
  > &
    FlatStatMap;
  /** Crecimiento por nivel (antes de aplicar la curva no lineal). */
  perLevel: FlatStatMap;
  /** Rango soportado por la UI (negocio: hasta 20). */
  levelRange: { min: number; max: number };
}

export interface ItemSummary {
  id: string;
  name: string;
  plaintext: string;
  descriptionText: string;
  imageUrl: string;
  gold: {
    base: number;
    total: number;
    sell: number;
    purchasable: boolean;
  };
  tags: string[];
  /** Mods planos normalizados (v1 de la calculadora). */
  stats: FlatStatMap;
  /** Mods % detectados; informativos en v1 (no aplicados al total). */
  percentBonuses: FlatStatMap;
  from: string[];
  into: string[];
  depth: number;
  version: string;
}

export interface ItemListResult {
  version: string;
  count: number;
  items: ItemSummary[];
}

/** Slot de build en el cliente (hasta 6). */
export interface BuildSlot {
  index: 0 | 1 | 2 | 3 | 4 | 5;
  itemId: string | null;
}

/**
 * Resultado del motor shared/buildMath (no es respuesta HTTP obligatoria;
 * el FE lo produce en local).
 */
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
