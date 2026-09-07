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
