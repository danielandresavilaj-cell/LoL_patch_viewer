# Documentación Maestra del Proyecto

**Proyecto:** LoL Champion & Patch Viewer  
**Tipo:** monorepo TypeScript (npm workspaces)  
**Fuente de datos:** Data Dragon de Riot Games (API pública, sin autenticación)  
**Audiencia:** ingeniería — guía de estudio del *porqué* y el *cómo*

---

## Índice

1. [Arquitectura del Sistema (Visión Global)](#1-arquitectura-del-sistema-visión-global)
2. [Ingesta y Procesamiento de Datos (Backend)](#2-ingesta-y-procesamiento-de-datos-el-backend)
3. [El Motor Matemático (`@lol-viewer/shared`)](#3-el-motor-matemático-el-paquete-lol-viewershared)
4. [Frontend y Rendimiento (React)](#4-frontend-y-rendimiento-react)
5. [DevOps e Infraestructura (Docker)](#5-devops-e-infraestructura-docker)
6. [Estrategia de Testing (Vitest)](#6-estrategia-de-testing-vitest)

---

## 1. Arquitectura del Sistema (Visión Global)

### 1.1 Por qué monorepo

El producto tiene tres concerns que comparten tipos y fórmulas, pero ciclos de vida distintos:

| Workspace | Paquete npm | Responsabilidad |
|-----------|-------------|-----------------|
| `backend/` | `@lol-viewer/backend` | BFF Fastify: HTTP, caché, normalización Data Dragon |
| `frontend/` | `@lol-viewer/frontend` | UI React/Vite: búsqueda, detalle, calculadora |
| `shared/` | `@lol-viewer/shared` | Dominio puro: crecimiento por nivel, AH→CDR, suma de builds |

Un monorepo con **npm workspaces** (definido en el `package.json` raíz) permite:

- Un solo `package-lock.json` y un `npm install` en la raíz.
- Importar `@lol-viewer/shared` desde frontend (y, si hace falta, backend) sin publicar a un registry.
- Un script global `npm run test` que ejecuta las suites de los tres workspaces.
- Builds Docker con contexto en la raíz, de modo que el compilador vea `shared/` al construir `frontend` o `backend`.

Si el motor matemático viviera solo en el frontend, el backend no podría reutilizarlo para validación futura. Si viviera solo en el backend, cada tick del slider de nivel exigiría un roundtrip HTTP. El paquete compartido rompe esa falsa dicotomía.

### 1.2 Patrón BFF (Backend for Frontend)

El browser **no** habla con Data Dragon directamente. Habla con nuestro BFF:

```text
Browser  →  /api/*  →  Fastify (api)  →  ddragon.leagueoflegends.com
```

Razones de diseño:

1. **CORS y origen único.** En producción nginx sirve la SPA y hace proxy de `/api` al contenedor `api`. El frontend usa rutas relativas (`/api/...`) y no necesita conocer el host de Riot.
2. **Contrato estable.** Data Dragon cambia claves (`FlatHPPoolMod`, HTML en `description`, IDs de Arena). El BFF traduce a DTOs tipados (`ItemSummary`, `ChampionScalingProfile`, `ChampionAbilityKit`).
3. **Caché y timeouts.** Un proceso Node centraliza TTL, `AbortController` y errores 502/504 homogéneos.
4. **Filtrado de negocio.** El catálogo de ítems por defecto es Grieta del Invocador canónica; el dump crudo de Riot no es usable tal cual en una calculadora.

Esto es un BFF clásico: no es un microservicio de dominio genérico, sino una capa hecha a medida del cliente React.

### 1.3 Árbol lógico del repositorio

```text
lol-champion-patch-viewer/
├── package.json              # workspaces + scripts globales
├── docker-compose.yml        # api + web en lol-viewer-net
├── .dockerignore
├── backend/
│   ├── Dockerfile            # multi-stage, context = raíz
│   ├── src/
│   │   ├── app.ts            # composition root (inyección de deps)
│   │   ├── cache/memoryCache.ts
│   │   ├── services/         # ddragonClient, championService, itemService
│   │   ├── routes/           # /health, /api/*
│   │   └── types/
│   └── tests/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── App.tsx           # shell Forge Dark (rail + stage)
│       ├── api/client.ts
│       ├── components/       # SearchBar, List, Detail, BuildCalculator, Abilities
│       └── hooks/useDebouncedValue.ts
├── shared/
│   └── src/buildMath.ts      # fórmulas puras
└── docs/                     # arquitectura, UX, esta wiki
```

### 1.4 Ciclo de vida de una petición (slider de nivel)

El caso pedagógico más importante: el usuario mueve el slider de nivel de 1 a 18. **Ese gesto no llama a la API.**

```text
┌─────────────────────────────────────────────────────────────────┐
│ FASE A — Carga (una vez por campeón / catálogo)                 │
│                                                                 │
│ 1. Usuario selecciona “Ahri” en el rail                         │
│ 2. App → GET /api/champions/Ahri                                │
│ 3. BuildCalculator → GET /api/champions/Ahri/scaling            │
│ 4. ChampionAbilities → GET /api/champions/Ahri/abilities        │
│ 5. Modal de ítems (al abrir slot) → GET /api/items?q=…          │
│                                                                 │
│    Cada GET:                                                    │
│      nginx (prod) o Vite proxy (dev)                            │
│        → Fastify route                                          │
│        → ChampionService / ItemService                          │
│        → DDragonClient (MemoryCache hit|miss)                   │
│        → HTTPS Data Dragon (solo en miss)                       │
│        → normalización DTO → JSON al browser                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ FASE B — Interacción en caliente (slider / slots)               │
│                                                                 │
│ 6. setLevel(18)  →  useDeferredValue(level)                     │
│ 7. useMemo(computeBuildStats({ profile, level, itemStats }))    │
│      │                                                          │
│      ├─ statsAtLevel(base, perLevel, 18)   // curva Riot        │
│      ├─ sumFlatStats(...ítems)             // mods planos       │
│      ├─ total = fromLevel + fromItems                           │
│      └─ abilityHasteToCdr(AH) + cooldownWithAbilityHaste        │
│ 8. UI re-render: tabla Stat|Campeón|Ítems|Total + CDs del kit   │
│                                                                 │
│    Cero roundtrips. Todo en el hilo del browser vía shared.     │
└─────────────────────────────────────────────────────────────────┘
```

**Por qué esta separación importa:** Data Dragon es lento y compartido. Escalar stats por nivel es CPU barata y determinista. Mezclar ambas en el hot path degradaría UX y saturaría la red.

### 1.5 Endpoints del BFF (mapa mental)

| Método | Ruta | Rol |
|--------|------|-----|
| `GET` | `/health` | Liveness (Compose healthcheck) |
| `GET` | `/api/versions` | Lista de versiones DD |
| `GET` | `/api/patches/latest` | Parche actual + anterior (banner) |
| `GET` | `/api/champions` | Lista filtrable (`q`, `tags`, `version`) |
| `GET` | `/api/champions/:id` | Detalle resumen |
| `GET` | `/api/champions/:id/scaling` | Perfil `base` + `perLevel` para la calculadora |
| `GET` | `/api/champions/:id/abilities` | Kit P/Q/W/E/R limpio |
| `GET` | `/api/items` | Catálogo SR canónico (params `map`, `canonical`, `q`) |

---

## 2. Ingesta y Procesamiento de Datos (El Backend)

### 2.1 Conexión a Data Dragon

`DDragonClient` (`backend/src/services/ddragonClient.js`) es el único módulo que conoce la URL base:

```text
https://ddragon.leagueoflegends.com
```

Recursos principales:

| Método | URL DD | Uso |
|--------|--------|-----|
| `getVersions()` | `/api/versions.json` | Primer elemento = parche “latest” |
| `getChampionList(version)` | `/cdn/{v}/data/{locale}/champion.json` | Índice de campeones |
| `getChampionDetail(id, version)` | `/cdn/{v}/data/{locale}/champion/{Id}.json` | Spells + passive |
| `getItemList(version)` | `/cdn/{v}/data/{locale}/item.json` | Tienda / stats de ítems |

Características de resiliencia:

- **Timeout** configurable (default 10s) con `AbortController` → error `504` tipado (`DDragonError`).
- **Inyección de `fetchImpl`** para tests: los tests pasan un `vi.fn()` y nunca tocan la red.
- **Locale** por defecto `en_US` (textos de ítems y habilidades alineados con las tablas de parseo).

### 2.2 Caché en memoria (TTL)

`MemoryCache` es un `Map<string, { value, expiresAt }>` con TTL por entrada.

```typescript
// TTLs efectivos en DDragonClient
VERSIONS_TTL_MS        = 1 hora
CHAMPIONS_TTL_MS       = 30 minutos
ITEMS_TTL_MS           = 30 minutos
CHAMPION_DETAIL_TTL_MS = 30 minutos
```

Claves típicas:

```text
versions
champions:{version}:{locale}
items:{version}:{locale}
champion-detail:{version}:{locale}:{championId}
```

**Por qué la necesitamos**

1. Data Dragon no está pensado para ser martilleado por cada keystroke de búsqueda.
2. Un proceso BFF de un solo nodo puede servir cientos de lecturas locales tras un miss.
3. El TTL es corto respecto al ciclo de parches de LoL (días/semanas), pero largo respecto a una sesión de usuario.

**Límite consciente:** la caché no se comparte entre réplicas. Si escaláramos horizontalmente, haría falta Redis u otra capa compartida. Para un viewer local / Compose de un nodo, in-memory es la opción correcta (simple, testeable, sin infra extra).

### 2.3 Composition root e inyección

`buildApp(deps)` en `app.ts` acepta `cache`, `ddragonClient`, `championService`, `itemService`. En producción se construyen por defecto; en tests se inyectan mocks. Esto es la base de las pruebas de rutas con `app.inject()` sin abrir puerto.

### 2.4 Normalización a DTOs

#### Campeones → `ChampionScalingProfile`

`toScalingProfile` mapea el objeto crudo `stats` de DD a claves de dominio:

| Data Dragon | Nuestro DTO |
|-------------|-------------|
| `hp`, `hpperlevel` | `base.hp`, `perLevel.hp` |
| `attackdamage`, `attackdamageperlevel` | `attackDamage` |
| `spellblock`, `spellblockperlevel` | `spellBlock` |
| … | … |

El frontend nunca ve `hpperlevel`: solo recibe `base` y `perLevel` tipados.

#### Ítems → `ItemSummary`

Pipeline por ítem:

1. **Filtro de inclusión** (`shouldIncludeRawItem`):
   - Excluye `hideFromAll`, ítems de campeón exclusivo.
   - Por defecto: mapa `"11"` (Summoner's Rift).
   - Por defecto: solo IDs canónicos `/^\d{1,4}$/` (elimina `228020` Arena, `328020` variantes, etc.).
2. **Mapeo numérico** `mapDDragonItemStats`: `FlatHPPoolMod` → `hp`, `Percent*` → `percentBonuses`.
3. **Enrich desde HTML** `enrichStatsFromDescription`: Ability Haste y pen. mágica a menudo viven solo en el bloque `<stats>` del HTML, no en el objeto `stats`.
4. **Limpieza de texto** `stripHtml`: quita tags Riot (`<attention>`, `<br>`, etc.) y deja `descriptionText` legible.

```typescript
// Idea del filtro canónico (por qué Abyssal Mask dejaba de duplicarse)
isCanonicalItemId("8020")    // true  → tienda SR real
isCanonicalItemId("228020")  // false → Arena
isCanonicalItemId("328020")  // false → variante 6 dígitos
```

#### Habilidades → `ChampionAbilityKit`

Desde `champion/{Id}.json`:

- Passive → slot `P`
- `spells[0..3]` → `Q`, `W`, `E`, `R`
- `stripHtml` en descripciones
- `detectDamageTypes` inspecciona tags del tooltip (`physicalDamage`, `magicDamage`, …)
- Cooldowns numéricos por rango quedan en el DTO; el **CD efectivo** se calcula en el cliente con AH de la build

**Límite de Data Dragon:** los tooltips usan placeholders (`{{ totaldamage }}`) sin ratios numéricos publicados. No calculamos daño exacto de skill solo con DD; sí escalamos enfriamiento vía AH y mostramos contexto AD/AP/HP.

### 2.5 Datos “sucios”: el problema del HTML

Un fragmento típico de `item.json`:

```html
<stats><attention>350</attention> Health<br><attention>15</attention> Ability Haste</stats>
```

Sin normalización, el frontend tendría que:

- renderizar HTML de terceros (riesgo XSS / UI rota), o
- reimplementar parsers frágiles en cada cliente.

La decisión de arquitectura: **toda limpieza ocurre en el BFF**. El contrato hacia React es JSON tipado + strings planos.

---

## 3. El Motor Matemático (El paquete `@lol-viewer/shared`)

### 3.1 Por qué un módulo puro sin dependencias

`shared/src/buildMath.ts` no importa React, Fastify ni `fetch`. Solo tipos y aritmética.

Beneficios:

| Beneficio | Detalle |
|-----------|---------|
| **Una sola fuente de verdad** | Misma fórmula en UI y en tests de dominio |
| **Testabilidad** | Vitest puro, sin jsdom ni HTTP |
| **Rendimiento** | Llamadas síncronas en cada tick del slider |
| **Portabilidad** | Vite resuelve el workspace con alias a `shared/src/index.ts` |

Principio: *lo que es matemática de League no es “lógica de UI” ni “lógica de API”.*

### 3.2 Crecimiento no lineal por nivel

Riot no usa `base + growth × (level − 1)` lineal puro. El factor de crecimiento es:

\[
f(\ell) = (\ell - 1) \times \bigl(0.7025 + 0.0175 \times (\ell - 1)\bigr)
\]

\[
\mathrm{stat}(\ell) = \mathrm{base} + \mathrm{growth} \times f(\ell)
\]

En código:

```typescript
export function growthFactor(level: number): number {
  const steps = level - 1;
  return steps * (0.7025 + 0.0175 * steps);
}

export function statAtLevel(base: number, growth: number, level: number): number {
  return base + growth * growthFactor(level);
}
```

Implicaciones didácticas:

- En nivel 1, \(f(1)=0\) → la stat es exactamente `base`.
- El crecimiento acelera ligeramente en niveles altos (término \(0.0175 \times (\ell-1)^2\) embebido).
- `statsAtLevel` aplica la curva a cada clave presente en `base` / `perLevel`.

El nivel se **clampa** a `[1, 20]` (configurable vía `levelRange` del perfil).

### 3.3 Ability Haste → CDR

Desde la eliminación del CDR clásico como stat primaria, Riot usa Ability Haste (AH):

\[
\mathrm{cdrRatio} = \frac{\mathrm{AH}}{\mathrm{AH} + 100}, \quad
\mathrm{cdrPercent} = \mathrm{cdrRatio} \times 100
\]

Enfriamiento efectivo de una habilidad:

\[
\mathrm{CD_{eff}} = \mathrm{CD_{base}} \times \frac{100}{100 + \mathrm{AH}}
= \mathrm{CD_{base}} \times \bigl(1 - \mathrm{cdrRatio}\bigr)
\]

```typescript
export function abilityHasteToCdr(abilityHaste: number) {
  const ah = Math.max(0, abilityHaste);
  const ratio = ah === 0 ? 0 : ah / (ah + 100);
  return { ratio, percent: ratio * 100 };
}

export function cooldownWithAbilityHaste(baseCooldown: number, abilityHaste: number) {
  return baseCooldown * (100 / (100 + Math.max(0, abilityHaste)));
}
```

Ejemplo: AH = 100 → 50% CDR → un CD de 10s pasa a 5s.

### 3.4 `computeBuildStats` — orquestación

Entrada (`ComputeBuildInput`):

- `profile`: `id`, `base`, `perLevel`, `levelRange`
- `level`
- `itemStats`: array de `FlatStatMap` (uno por slot ocupado)
- `itemIds` opcional (trazabilidad UI)

Salida (`BuildComputedStats`):

```typescript
{
  level,
  championId,
  itemIds,
  fromLevel,   // stats solo del campeón al nivel
  fromItems,   // suma de mods planos de ítems
  total,       // fromLevel + fromItems
  abilityHaste,
  cooldownReduction: { ratio, percent }
}
```

**Política v1:** solo se suman **mods planos**. Los `percentBonuses` viajan en el DTO de ítems como informativos; no se aplican al total (evita ambigüedad de orden de operaciones base→%→flat hasta una fase posterior).

---

## 4. Frontend y Rendimiento (React)

### 4.1 Jerarquía de componentes (Forge Dark)

Tras el refactor UX, el shell es una herramienta de trabajo, no una landing:

```text
App
├── topbar (marca + parche + toggle rail móvil)
└── shell
    ├── rail (aside)
    │   ├── SearchBar
    │   └── ChampionList
    └── stage (main)
        └── ChampionDetail  (si hay selección)
            ├── identity strip
            └── workspace (grid 2 cols)
                ├── BuildCalculator
                │   ├── nivel (slider + input)
                │   ├── 6 item slots
                │   ├── modal catálogo ítems
                │   └── tabla Stat | Campeón | Ítems | Total
                └── ChampionAbilities
                    └── P/Q/W/E/R + CD efectivo (AH de la build)
```

Tokens globales en `:root` (CSS puro): fondos `#0b0e14` / `#12161f`, acento oro, bonus de ítems en verde. Sin MUI/Bootstrap.

### 4.2 Flujo de datos en React

1. `App` posee `query`, `champions`, `selected`, `patch`.
2. `useDebouncedValue(query, 250)` dispara `fetchChampions`.
3. Al seleccionar, se hidrata el detalle y el stage monta `ChampionDetail`.
4. `BuildCalculator` carga scaling + (bajo demanda) ítems; calcula con `computeBuildStats`.
5. `onComputedChange` propaga el resultado al kit de habilidades para CDs en vivo.

El cliente HTTP (`api/client.ts`) usa `fetch` relativo a `/api`, compatible con Vite proxy y nginx.

### 4.3 `useDebouncedValue` en búsquedas

```typescript
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
```

**Dónde:**

- Búsqueda de campeones: **250 ms**
- Búsqueda de ítems en el modal: **200 ms**

**Por qué:** cada tecla no debe generar un `GET /api/champions?q=`. El debounce colapsa ráfagas de input en una sola petición tras pausa. El input permanece controlado e inmediato; solo el *efecto de red* espera.

### 4.4 `useDeferredValue` en la calculadora

```typescript
const [level, setLevel] = useState(1);
const deferredLevel = useDeferredValue(level);

const computed = useMemo(() => {
  if (!profile) return null;
  return computeBuildStats({
    profile,
    level: deferredLevel,
    itemStats: /* slots */,
    itemIds: /* … */,
  });
}, [profile, deferredLevel, slots /* … */]);
```

**Por qué no debounce aquí:** el slider debe sentirse continuo; debounce “congelaría” el valor. `useDeferredValue` marca el recálculo como trabajo de **prioridad baja**: React puede mantener el slider responsivo y posponer el trabajo de la tabla de stats si hay contención en el frame.

Combinado con `useMemo`, evitamos recalcular si `deferredLevel` y los slots no cambiaron.

### 4.5 Rendimiento: resumen de decisiones

| Técnica | Problema que resuelve |
|---------|------------------------|
| Cálculo local con `shared` | Latencia de red en cada tick |
| Debounce en búsquedas | Tormenta de requests |
| `useDeferredValue` en nivel | Jank del slider vs. tablas densas |
| Carga de ítems al abrir modal | No descargar catálogo hasta necesitarlo |
| Proxy mismo origen | Sin CORS, cookies/headers simples |

---

## 5. DevOps e Infraestructura (Docker)

### 5.1 Topología Compose

```yaml
services:
  api:   # Fastify :3001 (solo expose interno)
  web:   # nginx :80 → host :8080
networks:
  lol-net:
    name: lol-viewer-net
```

- `web` depende de `api` con `condition: service_healthy`.
- Healthcheck del API: `GET http://127.0.0.1:3001/health` desde dentro del contenedor.
- El API **no** publica puerto al host en el compose actual: todo el tráfico externo entra por nginx.

### 5.2 Ruteo interno (`nginx.conf` ↔ `api`)

```nginx
location / {
    try_files $uri $uri/ /index.html;   # SPA
}

location /api/ {
    proxy_pass http://api:3001;         # DNS de Compose en lol-viewer-net
    …
}

location = /health {
    proxy_pass http://api:3001/health;
}
```

Flujo de una petición del usuario en su PC:

```text
http://localhost:8080/api/champions
        │
        ▼
contenedor web (nginx)
        │  proxy_pass http://api:3001
        ▼
contenedor api (Fastify)  — hostname Docker: "api"
        │
        ▼
Data Dragon (Internet)
```

En desarrollo local (sin Docker), Vite replica el mismo patrón de mismo origen:

```typescript
// vite.config.ts
proxy: {
  "/api": { target: "http://127.0.0.1:3001" },
  "/health": { target: "http://127.0.0.1:3001" },
}
```

### 5.3 Dockerfiles multi-stage y el reto del monorepo

**Problema:** si el `context` era `./frontend`, la imagen no veía `shared/` y `npm` no resolvía `@lol-viewer/shared`.

**Solución:** `docker-compose.yml` fija `context: .` (raíz) y `dockerfile: frontend/Dockerfile` / `backend/Dockerfile`.

#### Frontend (resumen de etapas)

1. **build (node:22-alpine):** copia manifests de workspaces → `npm install --workspace=@lol-viewer/frontend --workspace=@lol-viewer/shared` → copia fuentes → `npm run build` con `VITE_API_URL=` (mismo origen).
2. **runtime (nginx:1.27-alpine):** copia `nginx.conf` + `frontend/dist` estático.

#### Backend (resumen de etapas)

1. **build:** instala backend+shared → compila TypeScript a `backend/dist`.
2. **runtime:** `npm install --omit=dev` → copia solo `dist` → `node dist/index.js` como usuario `node`.

`.dockerignore` en la raíz excluye `node_modules`, `dist`, tests, etc., para contextos de build livianos.

### 5.4 Cómo levantarlo

```bash
cd /ruta/a/lol-champion-patch-viewer
docker compose up --build
# UI: http://localhost:8080
```

Desarrollo sin contenedores:

```bash
npm install
npm run dev:backend    # :3001
npm run dev:frontend   # :5173 con proxy /api
```

---

## 6. Estrategia de Testing (Vitest)

### 6.1 Filosofía

> Probar contratos y matemáticas **sin red externa ni puertos reales**.

Más de **100 pruebas** (~120) repartidas en tres suites:

| Suite | Orden de magnitud | Qué valida |
|-------|-------------------|------------|
| `@lol-viewer/backend` | ~60+ | Cliente DD, caché, servicios, rutas HTTP |
| `@lol-viewer/shared` | ~20+ | Fórmulas de build / CDR / niveles |
| `@lol-viewer/frontend` | ~30+ | Componentes React, debounce, calculadora |

Comando raíz:

```bash
npm run test
# ≡ npm run test --workspaces --if-present
```

### 6.2 Backend: inyección y mocks de `fetch`

**Rutas sin listen:** Fastify `app.inject({ method, url })` simula HTTP in-process.

**Red simulada:**

```typescript
const fetchMock = vi.fn().mockResolvedValue(jsonResponse(mockChampionList));
const client = new DDragonClient({
  fetchImpl: fetchMock as unknown as typeof fetch,
  cache: new MemoryCache(),
});
const app = await buildApp({ ddragonClient: client });
```

Fixtures JSON locales imitan payloads de Data Dragon (incl. clones Arena para tests de filtro canónico).

Casos clave cubiertos:

- TTL de `MemoryCache` (expiración)
- Mapeo / enrich / `stripHtml` de ítems
- Filtro mapa 11 + IDs canónicos
- Escalado y kit de habilidades
- Errores tipados del error handler
- Contratos de `/api/*` (status + shape)

### 6.3 Shared: tests unitarios puros

`buildMath.test.ts` fija valores conocidos de `growthFactor`, `statAtLevel`, `abilityHasteToCdr`, `cooldownWithAbilityHaste` y `computeBuildStats` (incl. clamp de nivel y suma de ítems). Sin DOM.

### 6.4 Frontend: jsdom + Testing Library

- `environment: "jsdom"` en Vitest.
- `api/client` y `fetch` mockeados con fixtures en `src/test/fixtures.ts`.
- Se preservan `data-testid` para no acoplar tests a clases CSS del refactor visual.
- Debounce se prueba con timers / `userEvent` + esperas asíncronas.
- `BuildCalculator` verifica slots, nivel y presentación de bonus.

### 6.5 Qué conscientemente *no* testeamos aquí

- Builds reales de imagen Docker (el sandbox a menudo no tiene daemon).
- Llamadas live a Data Dragon en CI unitario (flaky + lento).
- E2E browser completo (Playwright/Cypress): fuera del alcance actual; el valor está en contratos y dominio.

---

## Apéndice A — Decisiones de diseño (ADR compactos)

| Decisión | Alternativa descartada | Motivo |
|----------|------------------------|--------|
| BFF Fastify + TS | Llamar DD desde el browser | CORS, caché, DTOs, filtrado |
| Math en `shared` | Solo backend o solo frontend | Hot path local + una verdad |
| Caché in-memory | Redis desde día 1 | Complejidad injustificada en 1 nodo |
| Ítems canónicos SR | Dump completo DD | Elimina duplicados/oro erróneo |
| CSS variables Forge Dark | Librería UI pesada | Ligereza y control total |
| Context Docker = raíz | Context por paquete | Workspaces + `shared` |

## Apéndice B — Glosario breve

| Término | Significado en este proyecto |
|---------|------------------------------|
| **Data Dragon** | CDN/API estática pública de assets y JSON de LoL |
| **BFF** | Backend for Frontend: API moldeada al cliente |
| **DTO** | Objeto de transferencia normalizado hacia el FE |
| **AH** | Ability Haste |
| **CDR** | Cooldown Reduction (derivada de AH) |
| **Canónico** | ID de ítem de tienda SR con ≤4 dígitos |
| **Forge Dark** | Sistema visual dark del refactor UX |

---

*Documento vivo: refleja el estado del monorepo tras Fase D (Docker monorepo), corrección de catálogo de ítems, habilidades con CD efectivo, y refactor frontend Forge Dark.*
