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
      <header className="app__hero">
        <p className="app__brand">LoL Champion &amp; Patch Viewer</p>
        <h1 className="app__headline">Encuentra stats por parche</h1>
        <p className="app__lede">
          Busca campeones Data Dragon y consulta estadísticas del parche activo.
        </p>
        {patch ? (
          <p className="app__patch" data-testid="patch-banner">
            Parche actual <strong>{patch.version}</strong>
            {patch.previous ? (
              <>
                {" "}
                · anterior <strong>{patch.previous}</strong>
              </>
            ) : null}
          </p>
        ) : null}
        <SearchBar value={query} onChange={setQuery} />
      </header>

      <main className="app__main">
        <section className="app__panel" aria-label="Resultados">
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
        </section>
        <aside className="app__panel app__panel--detail">
          <ChampionDetail champion={selected} loading={detailLoading} />
        </aside>
      </main>
    </div>
  );
}
