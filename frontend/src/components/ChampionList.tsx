import type { ChampionSummary } from "../types";
import "./ChampionList.css";

export interface ChampionListProps {
  champions: ChampionSummary[];
  selectedId?: string | null;
  onSelect: (champion: ChampionSummary) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function ChampionList({
  champions,
  selectedId,
  onSelect,
  loading = false,
  emptyMessage = "No hay campeones que coincidan.",
}: ChampionListProps) {
  if (loading) {
    return (
      <div className="champion-list" role="status" aria-live="polite">
        <p className="champion-list__status">Cargando campeones…</p>
      </div>
    );
  }

  if (champions.length === 0) {
    return (
      <div className="champion-list" role="status">
        <p className="champion-list__status">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="champion-list" aria-label="Lista de campeones">
      {champions.map((champion) => {
        const selected = champion.id === selectedId;
        return (
          <li key={champion.id}>
            <button
              type="button"
              className={
                selected
                  ? "champion-list__item champion-list__item--selected"
                  : "champion-list__item"
              }
              aria-pressed={selected}
              onClick={() => onSelect(champion)}
            >
              <img
                className="champion-list__avatar"
                src={champion.imageUrl}
                alt=""
                width={48}
                height={48}
                loading="lazy"
              />
              <span className="champion-list__meta">
                <span className="champion-list__name">{champion.name}</span>
                <span className="champion-list__title">{champion.title}</span>
                <span className="champion-list__tags">
                  {champion.tags.join(" · ")}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
