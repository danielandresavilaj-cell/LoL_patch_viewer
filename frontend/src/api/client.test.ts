import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  fetchChampions,
  fetchChampion,
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
});
