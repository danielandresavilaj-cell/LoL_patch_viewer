import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChampionDetail } from "./ChampionDetail";
import { mockAhri } from "../test/fixtures";

describe("ChampionDetail", () => {
  it("muestra placeholder sin selección", () => {
    render(<ChampionDetail champion={null} />);
    expect(
      screen.getByText(/selecciona un campeón/i),
    ).toBeInTheDocument();
  });

  it("muestra estado de carga", () => {
    render(<ChampionDetail champion={null} loading />);
    expect(screen.getByText(/cargando detalle/i)).toBeInTheDocument();
  });

  it("renderiza nombre, parche, blurb y stats", () => {
    render(<ChampionDetail champion={mockAhri} />);

    expect(
      screen.getByRole("heading", { name: "Ahri", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/parche 14\.1\.1/i)).toBeInTheDocument();
    expect(screen.getByText(/spirit realm/i)).toBeInTheDocument();
    expect(screen.getByText("HP")).toBeInTheDocument();
    expect(screen.getByText("590")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "attack" })).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
  });

  it("muestra ratings de info", () => {
    render(<ChampionDetail champion={mockAhri} />);
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("5/10")).toBeInTheDocument();
  });
});
