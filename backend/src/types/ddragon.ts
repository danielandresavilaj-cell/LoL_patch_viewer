/** Raw Data Dragon champion list entry (subset we rely on). */
export interface DDragonChampionRaw {
  id: string;
  key: string;
  name: string;
  title: string;
  blurb: string;
  tags: string[];
  partype: string;
  info: {
    attack: number;
    defense: number;
    magic: number;
    difficulty: number;
  };
  stats: Record<string, number>;
  image: {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface DDragonChampionListResponse {
  type: string;
  format: string;
  version: string;
  data: Record<string, DDragonChampionRaw>;
}

/** Normalized DTO exposed by our BFF. */
export interface ChampionSummary {
  id: string;
  key: string;
  name: string;
  title: string;
  blurb: string;
  tags: string[];
  partype: string;
  info: DDragonChampionRaw["info"];
  stats: Record<string, number>;
  imageUrl: string;
  version: string;
}

export interface ChampionListResult {
  version: string;
  count: number;
  champions: ChampionSummary[];
}

/** Raw Data Dragon item entry (subset we rely on). */
export interface DDragonItemRaw {
  name: string;
  description: string;
  colloq?: string;
  plaintext: string;
  into?: string[];
  from?: string[];
  depth?: number;
  image: {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  gold: {
    base: number;
    purchasable: boolean;
    total: number;
    sell: number;
  };
  tags: string[];
  maps?: Record<string, boolean>;
  stats: Record<string, number>;
}

export interface DDragonItemListResponse {
  type: string;
  version: string;
  data: Record<string, DDragonItemRaw>;
}
