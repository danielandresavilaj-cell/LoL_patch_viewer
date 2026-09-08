import type { ChampionSummary } from "../types";
import { BuildCalculator } from "./BuildCalculator";
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
  if (loading) {
    return (
      <section className="champion-detail" aria-busy="true">
        <p className="champion-detail__empty">Cargando detalle…</p>
      </section>
    );
  }

  if (!champion) {
    return (
      <section className="champion-detail" aria-live="polite">
        <p className="champion-detail__empty">
          Selecciona un campeón para ver estadísticas y parche.
        </p>
      </section>
    );
  }

  return (
    <section
      className="champion-detail"
      aria-label={`Detalle de ${champion.name}`}
    >
      <header className="champion-detail__header">
        <img
          className="champion-detail__portrait"
          src={champion.imageUrl}
          alt={champion.name}
          width={96}
          height={96}
        />
        <div>
          <p className="champion-detail__patch">Parche {champion.version}</p>
          <h2 className="champion-detail__name">{champion.name}</h2>
          <p className="champion-detail__title">{champion.title}</p>
          <p className="champion-detail__tags">{champion.tags.join(" · ")}</p>
        </div>
      </header>

      <p className="champion-detail__blurb">{champion.blurb}</p>

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

      <h3 className="champion-detail__stats-title">Estadísticas base</h3>
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

      <BuildCalculator championId={champion.id} version={champion.version} />
    </section>
  );
}
