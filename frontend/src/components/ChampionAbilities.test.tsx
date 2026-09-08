import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChampionAbilities } from "./ChampionAbilities";
import { mockAhriAbilities } from "../test/fixtures";

vi.mock("../api/client", () => ({
  fetchChampionAbilities: vi.fn(),
}));

import { fetchChampionAbilities } from "../api/client";

const mockedAbilities = vi.mocked(fetchChampionAbilities);

describe("ChampionAbilities", () => {
  beforeEach(() => {
    mockedAbilities.mockResolvedValue(mockAhriAbilities);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza P+QWER y tipos de daño", async () => {
    render(<ChampionAbilities championId="Ahri" version="14.1.1" />);

    expect(await screen.findByTestId("champion-abilities")).toBeInTheDocument();
    expect(screen.getByText("Essence Theft")).toBeInTheDocument();
    expect(screen.getByText("Orb of Deception")).toBeInTheDocument();
    expect(screen.getByTestId("ability-Q")).toHaveTextContent(/Mágico/);
    expect(mockedAbilities).toHaveBeenCalledWith("Ahri", "14.1.1");
  });

  it("muestra CD efectivo con Ability Haste", async () => {
    render(
      <ChampionAbilities
        championId="Ahri"
        version="14.1.1"
        abilityHaste={100}
        buildStats={{ attackDamage: 60, abilityPower: 80, hp: 700 }}
      />,
    );

    await screen.findByTestId("ability-cd-Q");
    expect(screen.getByTestId("ability-cd-Q")).toHaveTextContent(/→/);
    expect(screen.getByTestId("ability-cd-Q")).toHaveTextContent(/3\.5s/);
    expect(screen.getByTestId("ability-build-context")).toHaveTextContent(
      /AD 60/,
    );
  });

  it("permite cambiar el rango de una habilidad", async () => {
    render(<ChampionAbilities championId="Ahri" version="14.1.1" />);

    const rankInput = await screen.findByTestId("ability-rank-W");
    fireEvent.change(rankInput, { target: { value: "1" } });

    expect(screen.getByTestId("ability-cd-W")).toHaveTextContent("9s");
  });
});
