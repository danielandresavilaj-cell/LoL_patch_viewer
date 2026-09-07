# LoL Champion & Patch Viewer

Monorepo TypeScript: Fastify BFF + React/Vite.

## Estado

- **Fase 0–1:** scaffold, cliente Data Dragon, caché TTL, normalización
- **Fase 2:** API REST completa con manejo de errores (404 / 502 / 504)
- **Fase 3:** frontend React (buscador, lista, detalle, Vitest)
- **Fase 4:** Docker Compose (`api` + `web` + red `lol-viewer-net`)

## Docker

```bash
cd lol-champion-patch-viewer
docker compose up --build
# UI: http://localhost:8080  (nginx proxy /api y /health → api:3001)
```

Servicios en la red bridge interna `lol-viewer-net`: el browser solo habla con `web:80`; nginx reenvía `/api/*` y `/health` al servicio `api` (puerto 3001, no publicado al host).

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Healthcheck |
| GET | `/api/versions` | Lista de versiones Data Dragon |
| GET | `/api/patches/latest` | Parche actual + anterior |
| GET | `/api/champions?q=&tags=&version=` | Lista filtrada |
| GET | `/api/champions/:id?version=` | Detalle de campeón |

## Desarrollo

```bash
cd lol-champion-patch-viewer
npm install
npm run test:backend
npm run test:frontend
cd backend && npm run dev   # :3001
cd frontend && npm run dev  # :5173 (proxy /api → backend)
```

Variable opcional del frontend: `VITE_API_URL` (vacío en dev = mismo origen vía proxy Vite).

## Data Dragon

Sin autenticación. Endpoints usados:

- `https://ddragon.leagueoflegends.com/api/versions.json`
- `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json`
