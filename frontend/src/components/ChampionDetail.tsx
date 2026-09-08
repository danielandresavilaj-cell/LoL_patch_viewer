import { useCallback, useState } from "react";
import type { BuildComputedStats } from "@lol-viewer/shared";
import type { ChampionSummary } from "../types";
import { BuildCalculator } from "./BuildCalculator";
import { ChampionAbilities } from "./ChampionAbilities";
import "./ChampionDetail.css";

const STAT_LABELS: Array<{ key: string; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "mp", label: "MP" },
  { key: "armor", label: "Armor" },
  { key: "spellblock", label: "MR" },
  { key: "attackdamage", label: "AD" },
  { key: "attackspeed", label: "AS" },
  { key: "movespeed", label: "MS" },
  { key: "attackrange", label: "Range" },
];

export interface ChampionDetailProps {
  champion: ChampionSummary | null;
  loading?: boolean;
}

export function ChampionDetail({
  champion,
  loading = false,
}: ChampionDetailProps) {
  const [buildStats, setBuildStats] = useState<BuildComputedStats | null>(null);

  const handleComputed = useCallback((stats: BuildComputedStats | null) => {
    setBuildStats(stats);
  }, []);

  if (loading) {
    return (
      <section className="champion-detail champion-detail--loading" aria-busy="true">
        <p className="champion-detail__empty">Cargando detalle…</p>
        <div className="champion-detail__skeleton-strip" aria-hidden="true" />
        <div className="champion-detail__skeleton-grid" aria-hidden="true">
          <div />
          <div />
        </div>
      </section>
    );
  }

  if (!champion) {
    return (
      <section className="champion-detail champion-detail--empty" aria-live="polite">
        <div className="champion-detail__empty-card">
          <p className="champion-detail__empty-kicker">Forge</p>
          <p className="champion-detail__empty">
            Selecciona un campeón para ver estadísticas y parche.
          </p>
          <p className="champion-detail__empty-hint">
            Usa el panel izquierdo para buscar y abrir un kit.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="champion-detail"
      aria-label={`Detalle de ${champion.name}`}
    >
      <header className="champion-detail__identity">
        <img
          className="champion-detail__portrait"
          src={champion.imageUrl}
          alt={champion.name}
          width={88}
          height={88}
        />
        <div className="champion-detail__identity-main">
          <div className="champion-detail__identity-row">
            <h2 className="champion-detail__name">{champion.name}</h2>
            <p className="champion-detail__patch">v{champion.version}</p>
          </div>
          <p className="champion-detail__title">{champion.title}</p>
          <p className="champion-detail__tags">{champion.tags.join(" · ")}</p>
          <div className="champion-detail__ratings" aria-label="Ratings">
            {(
              [
                ["attack", champion.info.attack],
                ["defense", champion.info.defense],
                ["magic", champion.info.magic],
                ["difficulty", champion.info.difficulty],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="champion-detail__rating">
                <span>{label}</span>
                <strong>{value}/10</strong>
                <div
                  className="champion-detail__bar"
                  role="meter"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={10}
                  aria-label={label}
                >
                  <span style={{ width: `${(value / 10) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <p className="champion-detail__blurb">{champion.blurb}</p>

      <details className="champion-detail__base-stats">
        <summary>Estadísticas base (nivel 1 Data Dragon)</summary>
        <dl className="champion-detail__stats">
          {STAT_LABELS.map(({ key, label }) => {
            const value = champion.stats[key];
            if (value === undefined) return null;
            return (
              <div key={key} className="champion-detail__stat">
                <dt>{label}</dt>
                <dd>{Number.isInteger(value) ? value : value.toFixed(3)}</dd>
              </div>
            );
          })}
        </dl>
      </details>

      <div className="champion-detail__workspace">
        <BuildCalculator
          championId={champion.id}
          version={champion.version}
          onComputedChange={handleComputed}
        />
        <ChampionAbilities
          championId={champion.id}
          version={champion.version}
          abilityHaste={buildStats?.abilityHaste ?? 0}
          buildStats={buildStats?.total}
        />
      </div>
    </section>
  );
}
