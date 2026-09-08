import type { FastifyInstance } from "fastify";
import type { ChampionService } from "../services/championService.js";

function parseTags(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  const tags = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

export async function championsRoutes(
  app: FastifyInstance,
  championService: ChampionService,
): Promise<void> {
  app.get<{
    Querystring: { q?: string; tags?: string; version?: string };
  }>("/api/champions", async (request) => {
    return championService.listChampions({
      q: request.query.q,
      tags: parseTags(request.query.tags),
      version: request.query.version,
    });
  });

  app.get<{
    Params: { id: string };
    Querystring: { version?: string };
  }>("/api/champions/:id/scaling", async (request, reply) => {
    const { id } = request.params;
    const profile = await championService.getChampionScaling(
      id,
      request.query.version,
    );

    if (!profile) {
      return reply.status(404).send({
        error: `Champion '${id}' not found`,
        statusCode: 404,
      });
    }

    return profile;
  });

  app.get<{
    Params: { id: string };
    Querystring: { version?: string };
  }>("/api/champions/:id", async (request, reply) => {
    const { id } = request.params;
    const champion = await championService.getChampionById(
      id,
      request.query.version,
    );

    if (!champion) {
      return reply.status(404).send({
        error: `Champion '${id}' not found`,
        statusCode: 404,
      });
    }

    return champion;
  });
}
