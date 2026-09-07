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
