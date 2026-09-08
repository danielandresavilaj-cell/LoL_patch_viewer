import type { FlatStatMap } from "@lol-viewer/shared";

export type { FlatStatKey, FlatStatMap, BuildComputedStats } from "@lol-viewer/shared";

export interface ChampionInfo {
  attack: number;
  defense: number;
  magic: number;
  difficulty: number;
}

export interface ChampionSummary {
  id: string;
  key: string;
  name: string;
  title: string;
  blurb: string;
  tags: string[];
  partype: string;
  info: ChampionInfo;
  stats: Record<string, number>;
  imageUrl: string;
  version: string;
}

export interface ChampionListResult {
  version: string;
  count: number;
  champions: ChampionSummary[];
}

export interface PatchLatest {
  version: string;
  previous: string | null;
  recent: string[];
}

export interface ApiErrorBody {
  error: string;
  statusCode: number;
}

export interface ChampionScalingProfile {
  id: string;
  name: string;
  version: string;
  imageUrl: string;
  base: FlatStatMap;
  perLevel: FlatStatMap;
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
  stats: FlatStatMap;
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
