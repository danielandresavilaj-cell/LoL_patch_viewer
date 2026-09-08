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
    };
  }>("/api/items", async (request) => {
    return itemService.listItems({
      q: request.query.q,
      tags: parseTags(request.query.tags),
      purchasable: parsePurchasable(request.query.purchasable),
      version: request.query.version,
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
