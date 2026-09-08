import type { FastifyInstance } from "fastify";
import type { ItemService } from "../services/itemService.js";

function parseTags(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  const tags = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function parsePurchasable(raw?: string): boolean | undefined {
  if (raw === undefined || raw === "") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return undefined;
}

function parseBooleanFlag(
  raw: string | undefined,
  defaultValue: boolean,
): boolean {
  if (raw === undefined || raw === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return defaultValue;
}

/** `map=all` disables map filter; otherwise defaults to Summoner's Rift `11`. */
function parseMapId(raw?: string): string | null {
  if (raw === undefined || raw === "") return "11";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "all" || normalized === "*") return null;
  return raw.trim();
}

export async function itemsRoutes(
  app: FastifyInstance,
  itemService: ItemService,
): Promise<void> {
  app.get<{
    Querystring: {
      q?: string;
      tags?: string;
      purchasable?: string;
      version?: string;
      map?: string;
      canonical?: string;
    };
  }>("/api/items", async (request) => {
    return itemService.listItems({
      q: request.query.q,
      tags: parseTags(request.query.tags),
      purchasable: parsePurchasable(request.query.purchasable),
      version: request.query.version,
      mapId: parseMapId(request.query.map),
      canonicalOnly: parseBooleanFlag(request.query.canonical, true),
    });
  });

  app.get<{
    Params: { id: string };
    Querystring: { version?: string };
  }>("/api/items/:id", async (request, reply) => {
    const { id } = request.params;
    const item = await itemService.getItemById(id, request.query.version);

    if (!item) {
      return reply.status(404).send({
        error: `Item '${id}' not found`,
        statusCode: 404,
      });
    }

    return item;
  });
}
