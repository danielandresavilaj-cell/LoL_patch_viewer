# Fase 0 — Propuesta UX/UI: LoL Champion & Patch Viewer

**Alcance:** refactor visual y de layout del frontend (sin cambiar contratos API ni el motor `shared/buildMath`).  
**Stack visual:** React + CSS puro con variables en `:root` (sin MUI/Bootstrap).  
**Estado:** implementado (refactor frontend Forge Dark).

---

## 1. Diagnóstico del estado actual

Hoy la app se lee como una **landing + dos columnas sueltas**: hero grande, búsqueda, lista y detalle apilados. Funciona, pero:

- El hero ocupa viewport sin aportar a la tarea principal (buscar → build).
- La calculadora, habilidades y stats compiten en un scroll largo del panel derecho.
- Los slots de ítems no comunican claramente “vacío / ocupado / activo”.
- El aporte de ítems (`+N`) no tiene jerarquía tipográfica frente al total.
- La paleta clara teal no evoca el lenguaje visual de herramientas LoL (OP.GG / U.GG / cliente).

**Objetivo de producto:** herramienta de trabajo, no marketing. El primer viewport debe responder: *¿qué campeón? → ¿qué build? → ¿qué stats y CDs?*

---

## 2. Layout propuesto (arquitectura de la información)

### Escritorio (≥1100px): shell de 3 zonas

```text
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR (compacta): marca · parche activo · estado red        │
├────────────────┬─────────────────────────────────────────────┤
│  RAIL IZQ      │  STAGE (área principal)                     │
│  ~320–360px    │                                             │
│                │  A) Empty state (sin campeón)                │
│  SearchBar     │     ilustración + CTA “Busca un campeón”    │
│  ChampionList  │                                             │
│  (scroll)      │  B) Con campeón seleccionado:                │
│                │     ┌─────────────────────────────────────┐ │
│                │     │ IDENTITY STRIP                       │ │
│                │     │ portrait · nombre · tags · parche    │ │
│                │     └─────────────────────────────────────┘ │
│                │     ┌──────────────┬──────────────────────┐ │
│                │     │ BUILD COL    │ STATS + ABILITIES    │ │
│                │     │ nivel        │ tabla de stats       │ │
│                │     │ 6 slots      │ (base | ítems | tot) │ │
│                │     │ modal ítems  │ kit P/Q/W/E/R        │ │
│                │     │              │ CD efectivo          │ │
│                │     └──────────────┴──────────────────────┘ │
└────────────────┴─────────────────────────────────────────────┘
```

| Zona | Componentes | Rol |
|------|-------------|-----|
| **Topbar** | marca + badge de parche | Identidad y contexto de versión; altura fija ~56px |
| **Rail izquierdo** | `SearchBar` + `ChampionList` | Navegación persistente; scroll interno independiente |
| **Stage** | `ChampionDetail` + `BuildCalculator` + `ChampionAbilities` | Workspace del campeón seleccionado |

### Reorganización de componentes (sin romper lógica)

| Antes | Después |
|-------|---------|
| Hero marketing a pantalla completa | Topbar compacta (marca como señal fuerte pero no “landing”) |
| Lista y detalle en flujo vertical | Rail fijo + stage |
| Stats base, build y abilities en secuencia vertical | **Grid 2 columnas** en stage: build (izq.) / stats+abilities (der.) |
| Blurb + ratings siempre visibles | Ratings en identity strip (compactos); blurb colapsable o secundario |

### Tablet / móvil

- Rail se convierte en **drawer** o pestaña superior “Campeones”.
- Stage a una columna: Identity → Inventario+nivel → Stats → Abilities.
- Modal de ítems a **sheet inferior** (full-width) en viewports estrechos.

---

## 3. Sistema visual (tokens)

### Dirección estética

**“Forge Dark”** — dark mode limpio tipo herramienta competitiva: superficies profundas, acento oro/ámbar de identidad LoL, un verde de “bonus” y tipografía clara. Sin neones, sin glow excesivo, sin púrpura genérico.

### Paleta (`:root`)

| Token | Valor propuesto | Uso |
|-------|-----------------|-----|
| `--bg-deep` | `#0b0e14` | Fondo de app |
| `--bg-panel` | `#12161f` | Rail y paneles |
| `--bg-elevated` | `#1a2030` | Cards de interacción (slots, modal, filas) |
| `--bg-hover` | `#232a3b` | Hover de filas/slots |
| `--line` | `#2a3348` | Bordes sutiles |
| `--ink` | `#e8ecf4` | Texto primario |
| `--muted` | `#8b95a8` | Texto secundario |
| `--accent` | `#c8a45a` | Marca / foco / CTA suave (oro) |
| `--accent-soft` | `rgba(200,164,90,0.14)` | Fondos de selección |
| `--stat-base` | `#c5cddc` | Valor aportado por nivel/campeón |
| `--stat-item` | `#3ecf8e` | Bonus de ítems (`+40`) |
| `--stat-total` | `#ffffff` | Total enfatizado |
| `--danger` | `#e85d5d` | Errores / ítem no encontrado |
| `--focus-ring` | `#c8a45a` | Accesibilidad teclado |

Atmósfera: gradiente radial muy suave en `--bg-deep` (azul noche + toque ámbar en esquina superior), sin ruido visual.

### Tipografía

| Rol | Familia | Notas |
|-----|---------|-------|
| Display / marca | **Outfit** (o **Sora**) | Geométrica, moderna; no Inter/Roboto |
| UI / cuerpo | **Source Sans 3** | Legible en tablas densas |
| Números (stats, oro, CD) | **JetBrains Mono** o `tabular-nums` en Source Sans | Alineación vertical en la tabla |

Escala: topbar 0.875–1rem; nombre de campeón ~1.75rem; labels de stats 0.75rem uppercase tracking; valores 1–1.125rem.

### Forma y densidad

- Radio: **6–8px** (herramienta, no “pill app”).
- Sin sombras multicapa; elevación por contraste de superficie + borde.
- Espaciado base 8px; rail padding 12–16px; stage padding 20–24px.

---

## 4. Mejoras UX específicas

### 4.1 Rail de campeones

- Fila seleccionada: fondo `--accent-soft` + barra lateral dorada de 3px.
- Hover: `--bg-hover` + cursor pointer.
- Skeleton de 8 filas mientras carga (evita salto de layout).
- Contador sutil: `N campeones` bajo el search.
- Empty search: mensaje “Ningún campeón coincide” en el rail, no en el stage.

### 4.2 Identity strip

- Portrait con borde sutil; nombre + título en una línea; tags como texto muted (no chips redondos).
- Badge de parche siempre visible (`v16.x.x`).
- Estado loading del detalle: skeleton del strip + placeholder del grid (no solo texto).

### 4.3 Calculadora (inventario + nivel)

**Nivel**

- Slider + input numérico sincronizados (ya existe); visualmente el track usa `--accent` en la porción llena.
- Label grande: `Nivel 12` junto al control; el valor diferido no debe “titilar” el label (mostrar el valor del slider; las stats pueden ir un frame detrás con `useDeferredValue`).

**6 slots**

| Estado | Apariencia |
|--------|------------|
| Vacío | Borde dashed `--line`, icono `+` muted, hover → borde `--accent` + glow mínimo |
| Ocupado | Icono del ítem, fondo elevated, hover → overlay “cambiar” |
| Activo (modal abierto en ese slot) | Anillo `--accent` 2px |
| Focus teclado | `outline` con `--focus-ring` |

- Transición 150ms en border-color / transform scale(1.02) al hover.
- Click en ítem ocupado: mismo modal (reemplazar); botón ✕ en esquina del slot para vaciar (evita modal solo para quitar).
- Tooltip nativo o `title` con nombre + oro al hover del slot lleno.

**Modal de ítems**

- Overlay oscuro 60%; panel centrado (desktop) / bottom sheet (móvil).
- Search sticky arriba; lista virtualmente densa (filas de 48px: icono + nombre + oro).
- Cierre: Esc, click fuera, botón cerrar.
- Feedback al seleccionar: cierra modal + micro-animación del slot (fade-in del icono).

### 4.4 Tabla de estadísticas (legibilidad del aporte)

Formato visual por fila (no solo texto plano):

```text
HP     2100    +350     2450
       ↑base   ↑ítems   ↑total
       muted   verde    bold ink
```

- Columnas fijas con `tabular-nums`: **Stat | Campeón | Ítems | Total**.
- Si ítems = 0: mostrar `—` en muted en lugar de `+0` (menos ruido).
- Fila destacada para **Ability Haste** y debajo un callout: `CDR efectivo: 23.1%`.
- Separador visual entre ofensivas / defensivas / utilidad (agrupar keys).

### 4.5 Habilidades

- Grid horizontal P · Q · W · E · R con icono + letra de tecla.
- CD base tachado o secondary; **CD efectivo** en grande cuando AH > 0.
- Contexto AD/AP/HP de la build como chips informativos (no interactivos) encima del kit.
- Descripción en texto muted, max 4–5 líneas con “ver más” si hace falta (opcional v1 de UI).

### 4.6 Feedback global

- Errores de red: banner dismissible en topbar (no alert nativo).
- Modal sin resultados de ítems: empty state con copy claro.
- Preferir transiciones cortas (150–200ms); máximo 2–3 motion intencionados: atmósfera sutil, hover de slots, entrada del stage al seleccionar campeón (`fade` + `translateY(4px)`).

---

## 5. Mapa de archivos CSS (plan de implementación posterior)

Sin escribir componentes aún; al codificar:

| Archivo | Cambio |
|---------|--------|
| `index.html` / fonts | Cargar Outfit + Source Sans 3 |
| `App.css` | Tokens `:root`, shell grid, topbar, rail, stage |
| `SearchBar.css` | Input dark, focus ring |
| `ChampionList.css` | Filas densas, selected state |
| `ChampionDetail.css` | Identity strip + grid stage |
| `BuildCalculator.css` | Slots, slider, modal, tabla de stats |
| `ChampionAbilities.css` | Kit + CD efectivo |

Lógica React (`useDeferredValue`, `computeBuildStats`, fetches) **se preserva**; el refactor es principalmente estructura JSX + CSS.

---

## 6. Criterios de aceptación (cuando se implemente)

1. En desktop ≥1100px, con campeón seleccionado, **inventario + tabla de stats caben sin scroll de página** (scroll interno solo en rail / modal / abilities largas).
2. Diferencia base vs ítems vs total es obvia sin leer la leyenda.
3. Los 6 slots tienen estados hover/focus/activo claramente distintos.
4. Tests Vitest del frontend siguen en verde (ajustando selectores/`getBy*` si el markup cambia).
5. Sin librerías UI nuevas; solo CSS variables + componentes actuales.

---

## 7. Fuera de alcance (esta refactor)

- Rediseño del backend / DTOs.
- Temas claro/oscuro conmutables (solo dark en v1 de UI).
- Comparador de builds, export URL, gráficos de escalado.
- Recálculo de daño real de skills (limitación Data Dragon).

---

**Siguiente paso:** con tu luz verde, implemento el shell (topbar + rail + stage), tokens globales y el rediseño de `BuildCalculator` / stats / abilities, manteniendo los tests en verde.
