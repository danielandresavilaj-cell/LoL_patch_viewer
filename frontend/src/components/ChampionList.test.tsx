import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChampionList } from "./ChampionList";
import { mockAhri, mockGaren } from "../test/fixtures";

describe("ChampionList", () => {
  it("muestra estado de carga", () => {
    render(
      <ChampionList champions={[]} onSelect={() => undefined} loading />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/cargando campeones/i);
  });

  it("muestra mensaje vacío", () => {
    render(<ChampionList champions={[]} onSelect={() => undefined} />);
    expect(screen.getByText(/no hay campeones/i)).toBeInTheDocument();
  });

  it("renderiza nombres y títulos de campeones", () => {
    render(
      <ChampionList
        champions={[mockAhri, mockGaren]}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText("Ahri")).toBeInTheDocument();
    expect(screen.getByText("the Nine-Tailed Fox")).toBeInTheDocument();
    expect(screen.getByText("Garen")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /lista de campeones/i })).toBeInTheDocument();
  });

  it("notifica onSelect al hacer clic", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChampionList champions={[mockAhri, mockGaren]} onSelect={onSelect} />,
    );

    await user.click(screen.getByRole("button", { name: /ahri/i }));
    expect(onSelect).toHaveBeenCalledWith(mockAhri);
  });

  it("marca el campeón seleccionado con aria-pressed", () => {
    render(
      <ChampionList
        champions={[mockAhri, mockGaren]}
        selectedId="Garen"
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /garen/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /ahri/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
