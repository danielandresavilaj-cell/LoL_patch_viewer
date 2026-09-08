import { useEffect, useMemo, useState } from "react";
import {
  cooldownWithAbilityHaste,
  type FlatStatMap,
} from "@lol-viewer/shared";
import { fetchChampionAbilities } from "../api/client";
import type { ChampionAbility, ChampionAbilityKit } from "../types";
import "./ChampionAbilities.css";

const DAMAGE_LABELS: Record<string, string> = {
  physical: "Físico",
  magic: "Mágico",
  true: "Verdadero",
  heal: "Curación",
  shield: "Escudo",
  mixed: "Mixto",
  unknown: "Variable",
};

export interface ChampionAbilitiesProps {
  championId: string;
  version?: string;
  /** Ability Haste total de la build (actualiza CD en vivo). */
  abilityHaste?: number;
  /** Stats totales de la build para contexto AD/AP/HP. */
  buildStats?: FlatStatMap;
}

function formatCd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (Number.isInteger(value)) return `${value}s`;
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}s`.replace(/(\.\d*?)0+s$/, "$1s").replace(/\.s$/, "s");
}

function baseCooldownAtRank(ability: ChampionAbility, rank: number): number {
  if (!ability.cooldowns.length) return 0;
  const index = Math.min(
    ability.cooldowns.length - 1,
    Math.max(0, rank - 1),
  );
  return ability.cooldowns[index] ?? 0;
}

export function ChampionAbilities({
  championId,
  version,
  abilityHaste = 0,
  buildStats,
}: ChampionAbilitiesProps) {
  const [kit, setKit] = useState<ChampionAbilityKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ranks, setRanks] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setKit(null);
    setRanks({});

    fetchChampionAbilities(championId, version)
      .then((data) => {
        if (cancelled) return;
        setKit(data);
        const initial: Record<string, number> = {};
        for (const ability of data.abilities) {
          initial[ability.slot] = ability.maxRank;
        }
        setRanks(initial);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setError(
          err instanceof Error ? err.message : "No se pudieron cargar habilidades",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [championId, version]);

  const rows = useMemo(() => {
    if (!kit) return [];
    return kit.abilities.map((ability) => {
      const rank = ranks[ability.slot] ?? ability.maxRank;
      const baseCd = baseCooldownAtRank(ability, rank);
      const effectiveCd = cooldownWithAbilityHaste(baseCd, abilityHaste);
      return { ability, rank, baseCd, effectiveCd };
    });
  }, [kit, ranks, abilityHaste]);

  if (loading) {
    return (
      <section className="champion-abilities" aria-busy="true">
        <h3 className="champion-abilities__title">Habilidades</h3>
        <p className="champion-abilities__hint">Cargando kit…</p>
      </section>
    );
  }

  if (error || !kit) {
    return (
      <section className="champion-abilities" role="alert">
        <h3 className="champion-abilities__title">Habilidades</h3>
        <p className="champion-abilities__hint">
          {error ?? "Kit no disponible"}
        </p>
      </section>
    );
  }

  return (
    <section
      className="champion-abilities"
      aria-label={`Habilidades de ${kit.name}`}
      data-testid="champion-abilities"
    >
      <h3 className="champion-abilities__title">Habilidades</h3>
      <p className="champion-abilities__hint">
        Los enfriamientos se recalculan con la Ability Haste de tu build (AH{" "}
        {abilityHaste}). Data Dragon no publica ratios numéricos exactos de daño;
        usamos tipos de daño del tooltip y tus stats actuales como contexto.
      </p>

      {(buildStats?.attackDamage !== undefined ||
        buildStats?.abilityPower !== undefined ||
        buildStats?.hp !== undefined) && (
        <p className="champion-abilities__context" data-testid="ability-build-context">
          Stats de build: AD {Math.round(buildStats.attackDamage ?? 0)} · AP{" "}
          {Math.round(buildStats.abilityPower ?? 0)} · HP{" "}
          {Math.round(buildStats.hp ?? 0)}
        </p>
      )}

      <ul className="champion-abilities__list">
        {rows.map(({ ability, rank, baseCd, effectiveCd }) => (
          <li
            key={ability.slot}
            className="champion-abilities__card"
            data-testid={`ability-${ability.slot}`}
          >
            <div className="champion-abilities__head">
              <img
                src={ability.imageUrl}
                alt=""
                width={48}
                height={48}
              />
              <div>
                <p className="champion-abilities__slot">{ability.slot}</p>
                <h4>{ability.name}</h4>
                <p className="champion-abilities__types">
                  {ability.damageTypes
                    .map((t) => DAMAGE_LABELS[t] ?? t)
                    .join(" · ")}
                </p>
              </div>
            </div>

            <p className="champion-abilities__desc">{ability.description}</p>

            {ability.slot !== "P" ? (
              <div className="champion-abilities__meta">
                <label>
                  Rango
                  <input
                    type="number"
                    min={1}
                    max={ability.maxRank}
                    value={rank}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (!Number.isFinite(next)) return;
                      setRanks((prev) => ({
                        ...prev,
                        [ability.slot]: Math.min(
                          ability.maxRank,
                          Math.max(1, Math.trunc(next)),
                        ),
                      }));
                    }}
                    aria-label={`Rango de ${ability.slot}`}
                    data-testid={`ability-rank-${ability.slot}`}
                  />
                  /{ability.maxRank}
                </label>
                <p data-testid={`ability-cd-${ability.slot}`}>
                  CD {formatCd(baseCd)}
                  {abilityHaste > 0 ? (
                    <>
                      {" "}
                      → <strong>{formatCd(effectiveCd)}</strong>
                    </>
                  ) : null}
                </p>
                {ability.costBurn ? (
                  <p>Coste {ability.costBurn}</p>
                ) : null}
                {ability.rangeBurn ? (
                  <p>Alcance {ability.rangeBurn}</p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
