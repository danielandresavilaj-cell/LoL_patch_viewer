import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  fetchChampions,
  fetchChampion,
  fetchChampionAbilities,
  fetchChampionScaling,
  fetchItems,
  fetchLatestPatch,
} from "./client";

describe("api/client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchChampions construye querystring y parsea JSON", async () => {
    const payload = { version: "14.1.1", count: 0, champions: [] };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    const result = await fetchChampions({ q: "Ahri", tags: "Mage" });
    expect(result).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      "/api/champions?q=Ahri&tags=Mage",
    );
  });

  it("fetchChampion lanza ApiError en 404", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      new Response(
        JSON.stringify({ error: "Champion 'X' not found", statusCode: 404 }),
        { status: 404 },
      ),
    );

    const err = await fetchChampion("X").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      statusCode: 404,
      message: "Champion 'X' not found",
    });
  });

  it("fetchLatestPatch llama al endpoint de parches", async () => {
    const payload = {
      version: "14.1.1",
      previous: "14.1.0",
      recent: ["14.1.1"],
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    await expect(fetchLatestPatch()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith("/api/patches/latest");
  });

  it("fetchChampionScaling pide el perfil de escalado", async () => {
    const payload = { id: "Ahri", name: "Ahri", version: "14.1.1" };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    await expect(fetchChampionScaling("Ahri", "14.1.1")).resolves.toEqual(
      payload,
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/champions/Ahri/scaling?version=14.1.1",
    );
  });

  it("fetchItems construye filtros de catálogo", async () => {
    const payload = { version: "14.1.1", count: 0, items: [] };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    await expect(
      fetchItems({ q: "sword", purchasable: true }),
    ).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      "/api/items?q=sword&purchasable=true&map=11&canonical=true",
    );
  });

  it("fetchChampionAbilities pide el kit P+QWER", async () => {
    const payload = { championId: "Ahri", abilities: [] };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    await expect(fetchChampionAbilities("Ahri", "14.1.1")).resolves.toEqual(
      payload,
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/champions/Ahri/abilities?version=14.1.1",
    );
  });
});
