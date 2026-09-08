import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChampionDetail } from "./ChampionDetail";
import {
  mockAhri,
  mockAhriAbilities,
  mockAhriScaling,
} from "../test/fixtures";

vi.mock("../api/client", () => ({
  fetchChampionScaling: vi.fn(),
  fetchChampionAbilities: vi.fn(),
  fetchItems: vi.fn(),
}));

import {
  fetchChampionAbilities,
  fetchChampionScaling,
  fetchItems,
} from "../api/client";

const mockedScaling = vi.mocked(fetchChampionScaling);
const mockedAbilities = vi.mocked(fetchChampionAbilities);
const mockedItems = vi.mocked(fetchItems);

describe("ChampionDetail", () => {
  beforeEach(() => {
    mockedScaling.mockResolvedValue(mockAhriScaling);
    mockedAbilities.mockResolvedValue(mockAhriAbilities);
    mockedItems.mockResolvedValue({
      version: "14.1.1",
      count: 0,
      items: [],
      mapId: "11",
      canonicalOnly: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

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

  it("renderiza nombre, parche, blurb y stats", async () => {
    render(<ChampionDetail champion={mockAhri} />);

    expect(
      screen.getByRole("heading", { name: "Ahri", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/v14\.1\.1/i)).toBeInTheDocument();
    expect(screen.getByText(/spirit realm/i)).toBeInTheDocument();
    expect(screen.getByText("HP")).toBeInTheDocument();
    expect(screen.getByText("590")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "attack" })).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    await waitFor(() => {
      expect(screen.getByText(/calculadora de build/i)).toBeInTheDocument();
    });
  });

  it("muestra ratings de info", async () => {
    render(<ChampionDetail champion={mockAhri} />);
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("5/10")).toBeInTheDocument();
    await screen.findByTestId("build-level-slider");
  });

  it("integra la calculadora de build", async () => {
    render(<ChampionDetail champion={mockAhri} />);
    expect(await screen.findByTestId("build-level-slider")).toBeInTheDocument();
    expect(mockedScaling).toHaveBeenCalledWith("Ahri", "14.1.1");
  });

  it("integra habilidades del campeón", async () => {
    render(<ChampionDetail champion={mockAhri} />);
    expect(await screen.findByTestId("champion-abilities")).toBeInTheDocument();
    expect(mockedAbilities).toHaveBeenCalledWith("Ahri", "14.1.1");
    expect(screen.getByText("Orb of Deception")).toBeInTheDocument();
  });
});
