import type { FastifyInstance } from "fastify";
import type { DDragonClient } from "../services/ddragonClient.js";

export async function patchesRoutes(
  app: FastifyInstance,
  ddragonClient: DDragonClient,
): Promise<void> {
  app.get("/api/patches/latest", async () => {
    const versions = await ddragonClient.getVersions();
    const latest = versions[0];
    const previous = versions[1] ?? null;
    return {
      version: latest,
      previous,
      recent: versions.slice(0, 10),
    };
  });
}
