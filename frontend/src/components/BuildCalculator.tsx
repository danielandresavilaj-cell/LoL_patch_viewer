import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  computeBuildStats,
  type BuildComputedStats,
  type FlatStatKey,
} from "@lol-viewer/shared";
import {
  fetchChampionScaling,
  fetchItems,
} from "../api/client";
import type { ChampionScalingProfile, ItemSummary } from "../types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import "./BuildCalculator.css";

const SLOT_COUNT = 6;

const STAT_GROUPS: Array<{
  label: string;
  rows: Array<{ key: FlatStatKey; label: string }>;
}> = [
  {
    label: "Ofensiva",
    rows: [
      { key: "attackDamage", label: "Daño" },
      { key: "abilityPower", label: "Poder de habilidad" },
      { key: "attackSpeed", label: "Vel. de ataque" },
      { key: "crit", label: "Crítico" },
      { key: "armorPen", label: "Pen. armadura" },
      { key: "magicPen", label: "Pen. mágica" },
      { key: "lifesteal", label: "Robo de vida" },
      { key: "spellVamp", label: "Vampirismo de hechizo" },
    ],
  },
  {
    label: "Defensiva",
    rows: [
      { key: "hp", label: "Vida" },
      { key: "armor", label: "Armadura" },
      { key: "spellBlock", label: "Resistencia mágica" },
      { key: "hpRegen", label: "Regen. vida" },
    ],
  },
  {
    label: "Utilidad",
    rows: [
      { key: "mp", label: "Maná" },
      { key: "mpRegen", label: "Regen. maná" },
      { key: "moveSpeed", label: "Vel. de movimiento" },
      { key: "abilityHaste", label: "Aceleración de habilidad" },
    ],
  },
];

export interface BuildCalculatorProps {
  championId: string;
  version?: string;
  onComputedChange?: (stats: BuildComputedStats | null) => void;
}

type Slot = ItemSummary | null;

function formatStat(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

export function BuildCalculator({
  championId,
  version,
  onComputedChange,
}: BuildCalculatorProps) {
  const [profile, setProfile] = useState<ChampionScalingProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [level, setLevel] = useState(1);
  const deferredLevel = useDeferredValue(level);

  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => null),
  );
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const [catalog, setCatalog] = useState<ItemSummary[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [itemQuery, setItemQuery] = useState("");
  const debouncedItemQuery = useDebouncedValue(itemQuery, 200);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);
    setSlots(Array.from({ length: SLOT_COUNT }, () => null));
    setLevel(1);
    setActiveSlot(null);

    fetchChampionScaling(championId, version)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setLevel(data.levelRange.min);
        setProfileLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProfile(null);
        setProfileLoading(false);
        setProfileError(
          err instanceof Error ? err.message : "No se pudo cargar el escalado",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [championId, version]);

  useEffect(() => {
    if (activeSlot === null) return;

    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);

    fetchItems({
      q: debouncedItemQuery || undefined,
      purchasable: true,
      version,
      map: "11",
      canonical: true,
    })
      .then((result) => {
        if (cancelled) return;
        setCatalog(result.items);
        setCatalogLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalog([]);
        setCatalogLoading(false);
        setCatalogError(
          err instanceof Error ? err.message : "No se pudieron cargar ítems",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlot, debouncedItemQuery, version]);

  useEffect(() => {
    if (activeSlot === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveSlot(null);
        setItemQuery("");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSlot]);

  const equipped = useMemo(
    () => slots.filter((slot): slot is ItemSummary => slot !== null),
    [slots],
  );

  const computed = useMemo(() => {
    if (!profile) return null;
    return computeBuildStats({
      profile: {
        id: profile.id,
        base: profile.base,
        perLevel: profile.perLevel,
        levelRange: profile.levelRange,
      },
      level: deferredLevel,
      itemStats: equipped.map((item) => item.stats),
      itemIds: equipped.map((item) => item.id),
    });
  }, [profile, deferredLevel, equipped]);

  useEffect(() => {
    onComputedChange?.(computed);
  }, [computed, onComputedChange]);

  const minLevel = profile?.levelRange.min ?? 1;
  const maxLevel = profile?.levelRange.max ?? 20;

  function handleLevelChange(event: ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) return;
    setLevel(Math.min(maxLevel, Math.max(minLevel, Math.trunc(next))));
  }

  function openPicker(index: number) {
    setItemQuery("");
    setActiveSlot(index);
  }

  function closePicker() {
    setActiveSlot(null);
    setItemQuery("");
  }

  function selectItem(item: ItemSummary) {
    if (activeSlot === null) return;
    setSlots((prev) => {
      const next = [...prev];
      next[activeSlot] = item;
      return next;
    });
    closePicker();
  }

  function clearSlot(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  if (profileLoading) {
    return (
      <section className="build-calculator" aria-busy="true">
        <div className="build-calculator__controls">
          <h3 className="build-calculator__title">Calculadora de build</h3>
          <p className="build-calculator__hint">Cargando perfil de escalado…</p>
        </div>
      </section>
    );
  }

  if (profileError || !profile || !computed) {
    return (
      <section className="build-calculator" role="alert">
        <div className="build-calculator__controls">
          <h3 className="build-calculator__title">Calculadora de build</h3>
          <p className="build-calculator__hint">
            {profileError ?? "Perfil de escalado no disponible"}
          </p>
        </div>
      </section>
    );
  }

  const levelFill = ((level - minLevel) / Math.max(1, maxLevel - minLevel)) * 100;

  return (
    <section
      className="build-calculator"
      aria-label={`Calculadora de build de ${profile.name}`}
    >
      <div className="build-calculator__controls">
        <h3 className="build-calculator__title">Calculadora de build</h3>

        <div className="build-calculator__level">
          <label htmlFor="build-level-slider" className="build-calculator__level-label">
            Nivel{" "}
            <strong data-testid="build-level-value">{level}</strong>
          </label>
          <input
            id="build-level-slider"
            data-testid="build-level-slider"
            type="range"
            min={minLevel}
            max={maxLevel}
            step={1}
            value={level}
            onChange={handleLevelChange}
            aria-valuemin={minLevel}
            aria-valuemax={maxLevel}
            aria-valuenow={level}
            style={{
              background: `linear-gradient(90deg, var(--accent) ${levelFill}%, var(--bg-elevated) ${levelFill}%)`,
            }}
          />
          <input
            data-testid="build-level-input"
            type="number"
            min={minLevel}
            max={maxLevel}
            value={level}
            onChange={handleLevelChange}
            aria-label="Nivel numérico"
          />
        </div>

        <div className="build-calculator__inventory" aria-label="Inventario">
          {slots.map((slot, index) => {
            const isActive = activeSlot === index;
            const slotClass = [
              "build-calculator__slot",
              slot ? "build-calculator__slot--filled" : "",
              isActive ? "build-calculator__slot--active" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div key={index} className="build-calculator__slot-wrap">
                <button
                  type="button"
                  className={slotClass}
                  onClick={() => openPicker(index)}
                  title={
                    slot
                      ? `${slot.name} · ${slot.gold.total}g`
                      : `Ranura ${index + 1} vacía`
                  }
                  aria-label={
                    slot
                      ? `Cambiar ítem en ranura ${index + 1}: ${slot.name}`
                      : `Elegir ítem en ranura ${index + 1}`
                  }
                  data-testid={`build-slot-${index}`}
                >
                  {slot ? (
                    <>
                      <img src={slot.imageUrl} alt="" width={40} height={40} />
                      <span className="build-calculator__slot-overlay" aria-hidden="true">
                        Cambiar
                      </span>
                    </>
                  ) : (
                    <span aria-hidden="true">+</span>
                  )}
                </button>
                {slot ? (
                  <button
                    type="button"
                    className="build-calculator__slot-clear"
                    onClick={() => clearSlot(index)}
                    aria-label={`Quitar ${slot.name} de la ranura ${index + 1}`}
                    data-testid={`build-slot-clear-${index}`}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="build-calculator__results">
        <table className="build-calculator__stats" data-testid="build-stats">
          <thead>
            <tr>
              <th scope="col">Stat</th>
              <th scope="col">Campeón</th>
              <th scope="col">Ítems</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {STAT_GROUPS.map((group) => {
              const visibleRows = group.rows.filter(({ key }) => {
                const fromChamp = computed.fromLevel[key] ?? 0;
                const fromItems = computed.fromItems[key] ?? 0;
                const total = computed.total[key] ?? 0;
                return !(fromChamp === 0 && fromItems === 0 && total === 0);
              });
              if (visibleRows.length === 0) return null;
              return (
                <FragmentGroup key={group.label} label={group.label}>
                  {visibleRows.map(({ key, label }) => {
                    const fromChamp = computed.fromLevel[key] ?? 0;
                    const fromItems = computed.fromItems[key] ?? 0;
                    const total = computed.total[key] ?? 0;
                    return (
                      <tr
                        key={key}
                        className="build-calculator__stat"
                        data-stat={key}
                      >
                        <th scope="row">{label}</th>
                        <td
                          className="build-calculator__stat-base"
                          data-testid={`stat-${key}-champ`}
                        >
                          {formatStat(fromChamp)}
                        </td>
                        <td
                          className={
                            fromItems !== 0
                              ? "build-calculator__item-bonus"
                              : "build-calculator__stat-empty"
                          }
                          data-testid={
                            fromItems !== 0 ? `stat-${key}-items` : undefined
                          }
                        >
                          {fromItems !== 0
                            ? `+ ${formatStat(fromItems)}`
                            : "—"}
                        </td>
                        <td className="build-calculator__total">
                          = {formatStat(total)}
                        </td>
                      </tr>
                    );
                  })}
                </FragmentGroup>
              );
            })}
          </tbody>
        </table>

        <p className="build-calculator__cdr" data-testid="build-cdr">
          <span>
            AH <strong>{formatStat(computed.abilityHaste)}</strong>
          </span>
          <span className="build-calculator__cdr-sep">→</span>
          <span>
            CDR efectivo{" "}
            <strong>{formatStat(computed.cooldownReduction.percent)}%</strong>
          </span>
        </p>
      </div>

      {activeSlot !== null ? (
        <div
          className="build-calculator__modal"
          role="dialog"
          aria-modal="true"
          aria-label="Selector de ítems"
          data-testid="item-picker"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePicker();
          }}
        >
          <div className="build-calculator__modal-panel">
            <header className="build-calculator__modal-header">
              <h4>Ítems — ranura {activeSlot + 1}</h4>
              <button type="button" onClick={closePicker} aria-label="Cerrar">
                Cerrar
              </button>
            </header>
            <input
              type="search"
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="Buscar ítem…"
              aria-label="Buscar ítem"
              data-testid="item-search"
              className="build-calculator__item-search"
            />
            {catalogError ? (
              <p className="build-calculator__hint" role="alert">
                {catalogError}
              </p>
            ) : catalogLoading ? (
              <p className="build-calculator__hint">Cargando ítems…</p>
            ) : (
              <ul className="build-calculator__item-list">
                {catalog.length === 0 ? (
                  <li className="build-calculator__item-empty">
                    Sin resultados para esta búsqueda
                  </li>
                ) : (
                  catalog.slice(0, 40).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectItem(item)}
                        data-testid={`pick-item-${item.id}`}
                      >
                        <img
                          src={item.imageUrl}
                          alt=""
                          width={32}
                          height={32}
                        />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.gold.total}g</small>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FragmentGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <tr className="build-calculator__group">
        <th colSpan={4}>{label}</th>
      </tr>
      {children}
    </>
  );
}
