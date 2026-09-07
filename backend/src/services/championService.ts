import type {
  ChampionListResult,
  ChampionSummary,
  DDragonChampionRaw,
} from "../types/ddragon.js";
import { DDragonClient } from "./ddragonClient.js";

export interface ListChampionsQuery {
  q?: string;
  tags?: string[];
  version?: string;
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
    const raw = await this.client.getChampionList(version);
    const entry = raw.data[id] ?? Object.values(raw.data).find(
      (c) => c.id.toLowerCase() === id.toLowerCase(),
    );
    if (!entry) return undefined;
    return this.toSummary(entry, raw.version);
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
