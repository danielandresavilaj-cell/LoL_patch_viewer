import { useEffect, useState } from "react";
import { fetchChampions, fetchChampion, fetchLatestPatch } from "./api/client";
import { SearchBar } from "./components/SearchBar";
import { ChampionList } from "./components/ChampionList";
import { ChampionDetail } from "./components/ChampionDetail";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import type { ChampionSummary, PatchLatest } from "./types";
import "./App.css";

export default function App() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [champions, setChampions] = useState<ChampionSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChampionSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [patch, setPatch] = useState<PatchLatest | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLatestPatch()
      .then((data) => {
        if (!cancelled) setPatch(data);
      })
      .catch(() => {
        /* patch banner is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);

    fetchChampions({ q: debouncedQuery || undefined })
      .then((result) => {
        if (cancelled) return;
        setChampions(result.champions);
        setListLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setChampions([]);
        setListLoading(false);
        setListError(
          err instanceof Error ? err.message : "No se pudo cargar la lista",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  async function handleSelect(champion: ChampionSummary) {
    setSelected(champion);
    setRailOpen(false);
    setDetailLoading(true);
    try {
      const detail = await fetchChampion(champion.id, champion.version);
      setSelected(detail);
    } catch {
      /* keep summary already selected */
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="app__atmosphere" aria-hidden="true" />

      <header className="app__topbar">
        <p className="app__brand">LoL Champion &amp; Patch Viewer</p>
        <div className="app__topbar-actions">
          {patch ? (
            <p className="app__patch" data-testid="patch-banner">
              Parche <strong>{patch.version}</strong>
              {patch.previous ? (
                <>
                  {" "}
                  · ant. <strong>{patch.previous}</strong>
                </>
              ) : null}
            </p>
          ) : null}
          <button
            type="button"
            className="app__rail-toggle"
            aria-expanded={railOpen}
            aria-controls="champion-rail"
            onClick={() => setRailOpen((open) => !open)}
          >
            Campeones
          </button>
        </div>
      </header>

      <div className="app__shell">
        {railOpen ? (
          <button
            type="button"
            className="app__backdrop"
            aria-label="Cerrar lista de campeones"
            onClick={() => setRailOpen(false)}
          />
        ) : null}

        <aside
          id="champion-rail"
          className={railOpen ? "app__rail app__rail--open" : "app__rail"}
          aria-label="Buscar campeones"
        >
          <SearchBar value={query} onChange={setQuery} />
          {!listLoading && !listError ? (
            <p className="app__rail-meta">
              {champions.length} campeón{champions.length === 1 ? "" : "es"}
            </p>
          ) : null}
          <div className="app__rail-list">
            {listError ? (
              <p className="app__error" role="alert">
                {listError}
              </p>
            ) : (
              <ChampionList
                champions={champions}
                selectedId={selected?.id}
                onSelect={handleSelect}
                loading={listLoading}
              />
            )}
          </div>
        </aside>

        <main className="app__stage">
          <ChampionDetail champion={selected} loading={detailLoading} />
        </main>
      </div>
    </div>
  );
}
