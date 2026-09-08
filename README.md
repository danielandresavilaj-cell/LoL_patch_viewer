# LoL Champion & Patch Viewer

Monorepo TypeScript: Fastify BFF + React/Vite + motor matemático `@lol-viewer/shared`.

## Qué incluye

- Buscador de campeones y detalle con stats base
- Parches / versiones vía Data Dragon
- **Habilidades (P/Q/W/E/R)** con CD efectivo según Ability Haste de la build
- **Calculadora de Builds**: hasta 6 ítems (tienda SR canónica), nivel 1–20, stats en tiempo real y CDR

## Catálogo de ítems

Por defecto `GET /api/items` filtra:

- Mapa **11** (Grieta del Invocador)
- Solo IDs **canónicos** (≤4 dígitos)

Así se excluyen clones de Arena (`22xxxx`), ARAM (`77xxxx`) y variantes de tienda (`32xxxx`) que duplican nombres (p. ej. Abyssal Mask) con oro incorrecto. Usa `?map=all&canonical=false` para el dump completo de Data Dragon.

## Habilidades

En el detalle del campeón se muestra el kit completo (`GET /api/champions/:id/abilities`). Los enfriamientos se recalculan en vivo con:

```text
CD_efectivo = CD_base × 100 / (100 + AH)
```

Data Dragon no publica ratios numéricos exactos de daño (tooltips con `{{ placeholders }}`); la UI muestra tipos de daño del tooltip y AD/AP/HP de la build como contexto.

## Calculadora de Builds

En el detalle de un campeón aparece la calculadora:

1. Eliges el **nivel** (slider o input, 1–20).
2. Rellenas hasta **6 slots** de ítems (modal con `GET /api/items`).
3. Las stats se recalculan en el cliente con `computeBuildStats` (`@lol-viewer/shared`).

### Fórmulas

Crecimiento no lineal (Riot):

```text
stat(level) = base + growth × (level − 1) × (0.7025 + 0.0175 × (level − 1))
```

Ability Haste → reducción de enfriamiento:

```text
CDR% = 100 × AH / (AH + 100)
```

v1 suma solo **mods planos** de ítems. Los porcentuales se muestran en el DTO como informativos y no se aplican al total.

El backend normaliza `item.json` (strip HTML, mapeo de stats) y expone el perfil de escalado; el slider no hace roundtrip por tick.

## Docker

Los builds usan el **contexto en la raíz del monorepo** para que `frontend` (y el workspace) puedan resolver `@lol-viewer/shared`.

```bash
cd lol-champion-patch-viewer
docker compose up --build
# UI: http://localhost:8080  (nginx proxy /api y /health → api:3001)
```

| Servicio | Imagen | Red |
|----------|--------|-----|
| `api` | `backend/Dockerfile` (context `.`) | `lol-viewer-net`, solo `expose: 3001` |
| `web` | `frontend/Dockerfile` (context `.`) + `nginx.conf` | `8080:80` al host |

Flujo: browser → `localhost:8080` → nginx (`web`) → `api:3001` → Data Dragon.

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Healthcheck |
| GET | `/api/versions` | Lista de versiones Data Dragon |
| GET | `/api/patches/latest` | Parche actual + anterior |
| GET | `/api/champions?q=&tags=&version=` | Lista filtrada |
| GET | `/api/champions/:id?version=` | Detalle de campeón |
| GET | `/api/champions/:id/scaling` | Base + growth para la calculadora |
| GET | `/api/champions/:id/abilities` | Pasiva + Q/W/E/R normalizadas |
| GET | `/api/items?q=&tags=&purchasable=&version=&map=&canonical=` | Catálogo (default SR canónico) |
| GET | `/api/items/:id` | Detalle de ítem |

## Desarrollo

```bash
cd lol-champion-patch-viewer
npm install
npm run test                 # backend + shared + frontend
npm run test:backend
npm run test:shared
npm run test:frontend
npm run dev:backend          # :3001
npm run dev:frontend         # :5173 (proxy /api → backend)
```

Variable opcional del frontend: `VITE_API_URL` (vacío = mismo origen vía proxy Vite o nginx).

## Estructura

```text
lol-champion-patch-viewer/
├── backend/     # Fastify BFF + Data Dragon
├── frontend/    # React/Vite + BuildCalculator
├── shared/      # buildMath puro (curva Riot, AH→CDR, computeBuildStats)
├── docker-compose.yml
└── package.json # workspaces npm
```

## Data Dragon

Sin autenticación. Endpoints usados:

- `https://ddragon.leagueoflegends.com/api/versions.json`
- `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json`
- `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/item.json`
