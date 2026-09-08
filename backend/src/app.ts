import Fastify from "fastify";
import { MemoryCache } from "./cache/memoryCache.js";
import { DDragonClient } from "./services/ddragonClient.js";
import { ChampionService } from "./services/championService.js";
import { ItemService } from "./services/itemService.js";
import { registerErrorHandler } from "./plugins/errorHandler.js";
import { healthRoutes } from "./routes/health.js";
import { versionsRoutes } from "./routes/versions.js";
import { championsRoutes } from "./routes/champions.js";
import { patchesRoutes } from "./routes/patches.js";
import { itemsRoutes } from "./routes/items.js";

export interface AppDeps {
  cache?: MemoryCache;
  ddragonClient?: DDragonClient;
  championService?: ChampionService;
  itemService?: ItemService;
}

export async function buildApp(deps: AppDeps = {}) {
  const app = Fastify({ logger: false });
  const cache = deps.cache ?? new MemoryCache();
  const ddragonClient =
    deps.ddragonClient ?? new DDragonClient({ cache });
  const championService =
    deps.championService ?? new ChampionService(ddragonClient);
  const itemService = deps.itemService ?? new ItemService(ddragonClient);

  registerErrorHandler(app);

  await healthRoutes(app);
  await versionsRoutes(app, ddragonClient);
  await championsRoutes(app, championService);
  await patchesRoutes(app, ddragonClient);
  await itemsRoutes(app, itemService);

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: "Not Found",
      statusCode: 404,
    });
  });

  return app;
}
