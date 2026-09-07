import type { ChangeEvent } from "react";
import "./SearchBar.css";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar campeón…",
}: SearchBarProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="search-bar">
      <span className="search-bar__label">Buscar</span>
      <input
        className="search-bar__input"
        type="search"
        role="searchbox"
        aria-label="Buscar campeón"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        autoComplete="off"
      />
    </label>
  );
}
