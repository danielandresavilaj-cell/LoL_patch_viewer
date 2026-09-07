import type { FastifyInstance } from "fastify";
import type { DDragonClient } from "../services/ddragonClient.js";

export async function versionsRoutes(
  app: FastifyInstance,
  ddragonClient: DDragonClient,
): Promise<void> {
  app.get("/api/versions", async () => {
    const versions = await ddragonClient.getVersions();
    return {
      latest: versions[0],
      count: versions.length,
      versions,
    };
  });
}
