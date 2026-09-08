import type {
  ChampionListResult,
  ChampionScalingProfile,
  ChampionSummary,
  ItemListResult,
  ItemSummary,
  PatchLatest,
} from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiBase(): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  return base.replace(/\/$/, "");
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore parse errors */
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export interface ListChampionsParams {
  q?: string;
  tags?: string;
  version?: string;
}

export interface ListItemsParams {
  q?: string;
  tags?: string;
  purchasable?: boolean;
  version?: string;
}

export function fetchChampions(
  params: ListChampionsParams = {},
): Promise<ChampionListResult> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.tags?.trim()) qs.set("tags", params.tags.trim());
  if (params.version?.trim()) qs.set("version", params.version.trim());
  const query = qs.toString();
  return request<ChampionListResult>(
    `/api/champions${query ? `?${query}` : ""}`,
  );
}

export function fetchChampion(
  id: string,
  version?: string,
): Promise<ChampionSummary> {
  const qs = version ? `?version=${encodeURIComponent(version)}` : "";
  return request<ChampionSummary>(
    `/api/champions/${encodeURIComponent(id)}${qs}`,
  );
}

export function fetchChampionScaling(
  id: string,
  version?: string,
): Promise<ChampionScalingProfile> {
  const qs = version ? `?version=${encodeURIComponent(version)}` : "";
  return request<ChampionScalingProfile>(
    `/api/champions/${encodeURIComponent(id)}/scaling${qs}`,
  );
}

export function fetchItems(
  params: ListItemsParams = {},
): Promise<ItemListResult> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.tags?.trim()) qs.set("tags", params.tags.trim());
  if (params.purchasable !== undefined) {
    qs.set("purchasable", String(params.purchasable));
  }
  if (params.version?.trim()) qs.set("version", params.version.trim());
  const query = qs.toString();
  return request<ItemListResult>(`/api/items${query ? `?${query}` : ""}`);
}

export function fetchItem(id: string, version?: string): Promise<ItemSummary> {
  const qs = version ? `?version=${encodeURIComponent(version)}` : "";
  return request<ItemSummary>(
    `/api/items/${encodeURIComponent(id)}${qs}`,
  );
}

export function fetchLatestPatch(): Promise<PatchLatest> {
  return request<PatchLatest>("/api/patches/latest");
}
