# Diseño arquitectónico: Calculadora de Builds y Escalado de Nivel

**Proyecto:** `lol-champion-patch-viewer`  
**Alcance:** extensión sobre el BFF Fastify + React/Vite existentes  
**Fuente de datos:** Data Dragon (`item.json`, stats de campeón) — sin Riot API autenticada  
**Estado:** documento de diseño (sin implementación)

---

## 1. División de responsabilidades

### Principio

El backend actúa como **BFF + normalizador de contrato**. El frontend posee la **interactividad en tiempo real**. La matemática determinista y pura se encapsula en un **módulo compartido de dominio** (`packages/build-math` o `shared/buildMath`) importable por ambos, para no duplicar fórmulas ni depender de red en cada tick del slider.

### Matriz de decisión

| Concern | Dónde | Justificación |
|---------|--------|---------------|
| Descarga y caché de `item.json` / lista de campeones | **Backend** | Ya existe patrón BFF + TTL; CORS, timeouts y degradación 502/504 unificados. |
| Limpieza de HTML en `description` / `plaintext` | **Backend** | Data Dragon mezcla tags (`<stats>`, `<attention>`, `<br>`). El browser no debe parsear HTML de ítems; el DTO entrega texto plano y stats numéricas tipadas. |
| Mapeo `FlatHPPoolMod` → `hp`, `Percent*` → flags, etc. | **Backend** | Contrato estable frente a cambios de claves internas de Riot. |
| Fórmula de crecimiento no lineal | **Shared (puro)** + consumo en **Frontend** | Fórmula fija de Riot; debe ser testeable unitariamente sin HTTP. El FE la aplica al mover el nivel. El BE puede reutilizarla en un endpoint opcional de “preview” o validación, no en el hot path del slider. |
| Suma en tiempo real (base + growth(level) + ítems) | **Frontend** | Cada frame del slider (1→20) no puede ir al servidor: latencia, coste y re-renders. Cálculo local sincrónico sobre DTOs ya cargados. |
| Ability Haste → % CDR | **Shared (puro)** + UI en **Frontend** | Misma razón: actualización instantánea al añadir/quitar ítems. |
| Persistencia de build / share URL | Fuera de v1 (opcional FE: query params) | No requerido en el negocio actual. |

### Fórmulas de dominio (referencia de diseño)

Crecimiento por nivel (Riot, stats con `*perlevel`):

```text
stat(level) = base + growth × (level − 1) × (0.7025 + 0.0175 × (level − 1))
```

Reducción de enfriamiento desde Ability Haste (AH):

```text
cdrRatio = AH / (AH + 100)          // fracción 0..1
cdrPercent = cdrRatio × 100         // para UI
```

Solo se suman **mods planos** de ítems en v1 (`Flat*Mod`). Los mods porcentuales se exponen en el DTO como `percentBonuses` informativos pero **no** se aplican al total final hasta una fase posterior (evita ambigüedad de orden base→%→flat).

### Flujo de datos

```text
Data Dragon item.json / champion stats
        │
        ▼
Backend (normaliza, limpia HTML, cachea)
        │  GET /api/items?q=
        │  GET /api/champions/:id  (stats tipadas base + perLevel)
        ▼
React: carga ítems + perfil de escalado una vez
        │
        ▼
shared/buildMath.computeBuild({ level, base, perLevel, items[] })
        │
        ▼
UI (stats finales + CDR%) — sin roundtrip por tick
```

---

## 2. Modelo de datos (DTOs)

Contrato que el backend entrega al frontend. Los nombres se alinean con el estilo actual (`ChampionSummary`, etc.).

### Stats tipadas (campeón e ítems)

```typescript
/** Claves de combate que la calculadora v1 agrega de forma explícita. */
export type FlatStatKey =
  | "hp"
  | "mp"
  | "armor"
  | "spellBlock"   // MR
  | "attackDamage"
  | "abilityPower"
  | "attackSpeed"  // valor absoluto aportado por ítems (no ratio base)
  | "moveSpeed"
  | "crit"
  | "hpRegen"
  | "mpRegen"
  | "armorPen"
  | "magicPen"
  | "lifesteal"
  | "spellVamp"
  | "abilityHaste";

export type FlatStatMap = Partial<Record<FlatStatKey, number>>;

/** Perfil de escalado del campeón (ya normalizado; sin claves crudas de DDragon). */
export interface ChampionScalingProfile {
  id: string;
  name: string;
  version: string;
  imageUrl: string;
  /** Stats en nivel 1 (bases Data Dragon). */
  base: Required<
    Pick<
      FlatStatMap,
      | "hp"
      | "mp"
      | "armor"
      | "spellBlock"
      | "attackDamage"
      | "attackSpeed"
      | "moveSpeed"
      | "crit"
      | "hpRegen"
      | "mpRegen"
    >
  > &
    FlatStatMap;
  /** Crecimiento por nivel (antes de aplicar la curva no lineal). */
  perLevel: FlatStatMap;
  /** Rango soportado por la UI (negocio: hasta 20). */
  levelRange: { min: number; max: number }; // { min: 1, max: 20 }
}

export interface ItemSummary {
  id: string;           // "3031"
  name: string;
  plaintext: string;    // sin HTML
  descriptionText: string; // HTML stripped
  imageUrl: string;
  gold: {
    base: number;
    total: number;
    sell: number;
    purchasable: boolean;
  };
  tags: string[];
  /** Mods planos normalizados (v1 de la calculadora). */
  stats: FlatStatMap;
  /** Mods % detectados; informativos en v1 (no aplicados al total). */
  percentBonuses: FlatStatMap;
  from: string[];       // componentes
  into: string[];       // upgrades
  depth: number;
  version: string;
}

export interface ItemListResult {
  version: string;
  count: number;
  items: ItemSummary[];
}

/** Slot de build en el cliente (hasta 6). */
export interface BuildSlot {
  index: 0 | 1 | 2 | 3 | 4 | 5;
  itemId: string | null;
}

/**
 * Resultado del motor shared/buildMath (no es respuesta HTTP obligatoria;
 * el FE lo produce en local. El BE puede exponer POST /api/builds/preview opcional).
 */
export interface BuildComputedStats {
  level: number;
  championId: string;
  itemIds: string[];
  /** Stat a nivel N sin ítems. */
  fromLevel: FlatStatMap;
  /** Suma de mods planos de ítems. */
  fromItems: FlatStatMap;
  /** fromLevel + fromItems (claves unidas). */
  total: FlatStatMap;
  abilityHaste: number;
  cooldownReduction: {
    ratio: number;   // 0..1
    percent: number; // 0..100
  };
}
```

### Endpoints previstos (Fase Items + ampliación campeón)

| Método | Ruta | Respuesta |
|--------|------|-----------|
| `GET` | `/api/items?q=&tags=&purchasable=true&version=` | `ItemListResult` |
| `GET` | `/api/items/:id?version=` | `ItemSummary` \| 404 |
| `GET` | `/api/champions/:id/scaling?version=` | `ChampionScalingProfile` |

`GET /api/champions/:id` existente puede enriquecerse con `base`/`perLevel` tipados, o mantenerse y añadir la ruta `/scaling` para no romper el contrato actual del visor.

---

## 3. Manejo de estado (React)

### Objetivo

El slider de nivel (1–20) dispara muchos eventos `onChange`. No debe re-renderizar el buscador de campeones, la lista ni el árbol completo de `App`.

### Estructura propuesta

```text
App
├── Champion search / list / detail (estado existente)
└── BuildCalculator (isla de estado local)
    ├── level (number)           ← actualiza en cada pointer move
    ├── deferredLevel            ← useDeferredValue(level)
    ├── slots: BuildSlot[6]
    ├── itemCatalog (cache query)
    └── derived = useMemo(
          () => computeBuild(...),
          [scalingProfile, slots, deferredLevel]
        )
```

### Reglas concretas

1. **Estado local en `BuildCalculator`**, no Context global para `level`/`slots`. Solo subir al padre el `championId` ya seleccionado (prop).
2. **`useDeferredValue(level)`** (o `startTransition` al setear nivel): el thumb del slider sigue al dedo con el valor “urgente”; el recálculo de stats y tablas grandes usa el valor diferido, evitando jank.
3. **`useMemo` + función pura `computeBuild`** del paquete shared: coste O(stats × 6) trivial; memo evita trabajo si `deferredLevel` aún no cambió.
4. **Catálogo de ítems:** una carga (`useEffect` / React Query ligero) al montar o al cambiar `version`; filtrado de búsqueda de ítems en memoria (como campeones).
5. **Selección de ítem:** actualizar solo el slot concreto (`setSlots` inmutable); no clonar el catálogo.
6. **No** meter `level` en la URL en cada tick; si se quiere shareable build, serializar en `blur`/botón “Copiar build”.
7. Componentes presentacionales (`StatTable`, `ItemSlotGrid`, `LevelSlider`) reciben props primitivas/estables; `React.memo` solo donde el profiler lo justifique (empezar sin over-memoization).
8. El debounce existente (`useDebouncedValue`) se reserva para **búsqueda de texto** de ítems/campeones, no para el slider (el slider usa deferred value, no debounce de 300 ms).

### Por qué no Redux/Zustand en v1

El estado de build es acotado a una pantalla y un ciclo de vida corto. Un store global añade boilerplate sin beneficio hasta que exista sync multi-vista o persistencia compleja.

---

## 4. Plan de acción (Roadmap)

### Fase A — Contrato e ítems (Backend)

- Extender `ddragonClient` con `getItemList` / caché TTL.
- `itemService`: strip HTML, mapeo de mods planos → `FlatStatMap`, filtros `q` / `purchasable`.
- Rutas `/api/items` y `/api/items/:id`.
- Endpoint `/api/champions/:id/scaling` con `base` + `perLevel` tipados.
- **Terminal:** `npm run test --workspace=backend` (nuevos tests de servicio + rutas; regresión de los 32 actuales).

### Fase B — Motor matemático compartido

- Crear `shared/buildMath` (o `packages/build-math`): `statAtLevel`, `sumFlatStats`, `abilityHasteToCdr`, `computeBuild`.
- Fixtures con valores conocidos (p. ej. nivel 1 = base; nivel 18 curva documentada).
- **Terminal:** Vitest del paquete shared (`npm run test --workspace=shared` o path dedicado) **antes** de cablear UI.

### Fase C — UI calculadora (Frontend)

- `BuildCalculator`, `LevelSlider` (1–20), `ItemSlotGrid` (máx. 6), buscador de ítems, `StatTable` (base / nivel / ítems / total + CDR%).
- Integrar en detalle de campeón o ruta lateral sin romper el visor actual.
- Cliente API: `fetchItems`, `fetchChampionScaling`.
- **Terminal:** `npm run test --workspace=@lol-viewer/frontend` (componentes + `computeBuild` integrado vía tests de tabla de stats).

### Fase D — Hardening y Docker

- Tests de regresión monorepo: `npm test` raíz (backend + frontend + shared).
- Actualizar `README` y, si aplica, sin cambios de red Compose (mismo `api`/`web`).
- **Terminal:** `npm run build` en backend y frontend; smoke manual del slider 1→20.

### Orden de gates Vitest

| Momento | Comando | Criterio de salida |
|---------|---------|-------------------|
| Fin Fase A | `npm run test --workspace=backend` | Items + scaling + suite previa en verde |
| Fin Fase B | tests de `buildMath` | Fórmulas y CDR verificados sin UI |
| Fin Fase C | `npm run test --workspace=@lol-viewer/frontend` | Slider diferido, slots, render de totales |
| Cierre | `npm test` (raíz) | Todo el monorepo en verde |

---

## Riesgos y límites (extensión)

| Riesgo | Mitigación |
|--------|------------|
| `item.json` grande | Filtrar no comprables / mythic legacy según tags; DTO delgado; caché memoria. |
| Stats % y orden de aplicación | v1 solo planos; documentar `percentBonuses` como no aplicados. |
| Attack speed base vs bonus | Separar en DTO; UI etiqueta “AS base” vs “AS ítems”. |
| Nivel 19–20 (modos flex) | `levelRange.max = 20`; fórmula Riot sigue siendo válida matemáticamente. |
| Duplicar fórmulas BE/FE | Un solo módulo shared importado por ambos. |

---

## Decisión de arquitectura (resumen)

- **Backend:** ingesta, limpieza HTML, normalización de ítems y perfil de escalado.  
- **Shared:** curva de nivel + AH→CDR + agregación pura.  
- **Frontend:** estado local de build, `useDeferredValue` en el nivel, render en tiempo real sin chatty API.

Cuando confirmes este diseño, el siguiente paso de implementación es la **Fase A** (endpoint de ítems + scaling).
`)