import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuildCalculator } from "./BuildCalculator";
import {
  mockAhriScaling,
  mockFiendishCodex,
  mockLongSword,
} from "../test/fixtures";
import { growthFactor } from "@lol-viewer/shared";

vi.mock("../api/client", () => ({
  fetchChampionScaling: vi.fn(),
  fetchItems: vi.fn(),
}));

import { fetchChampionScaling, fetchItems } from "../api/client";

const mockedScaling = vi.mocked(fetchChampionScaling);
const mockedItems = vi.mocked(fetchItems);

describe("BuildCalculator", () => {
  beforeEach(() => {
    mockedScaling.mockResolvedValue(mockAhriScaling);
    mockedItems.mockResolvedValue({
      version: "14.1.1",
      count: 2,
      items: [mockLongSword, mockFiendishCodex],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("carga el perfil y muestra stats de nivel 1", async () => {
    render(<BuildCalculator championId="Ahri" version="14.1.1" />);

    expect(await screen.findByTestId("build-level-value")).toHaveTextContent(
      "1",
    );
    expect(screen.getByTestId("stat-hp-champ")).toHaveTextContent("590");
    expect(screen.getByTestId("stat-attackDamage-champ")).toHaveTextContent(
      "53",
    );
    expect(mockedScaling).toHaveBeenCalledWith("Ahri", "14.1.1");
  });

  it("recalcula con la curva Riot al cambiar el nivel", async () => {
    render(<BuildCalculator championId="Ahri" version="14.1.1" />);
    await screen.findByTestId("build-level-value");

    fireEvent.change(screen.getByTestId("build-level-input"), {
      target: { value: "18" },
    });

    const expectedHp =
      mockAhriScaling.base.hp! +
      mockAhriScaling.perLevel.hp! * growthFactor(18);
    const expectedHpText = Number.isInteger(expectedHp)
      ? String(expectedHp)
      : expectedHp.toFixed(2);

    await waitFor(() => {
      expect(screen.getByTestId("build-level-value")).toHaveTextContent("18");
      expect(screen.getByTestId("stat-hp-champ")).toHaveTextContent(
        expectedHpText,
      );
    });
  });

  it("abre el selector al hacer clic en una ranura vacía", async () => {
    const user = userEvent.setup();
    render(<BuildCalculator championId="Ahri" version="14.1.1" />);
    await screen.findByTestId("build-level-value");

    await user.click(screen.getByTestId("build-slot-0"));

    expect(await screen.findByTestId("item-picker")).toBeInTheDocument();
    expect(await screen.findByText("Long Sword")).toBeInTheDocument();
    expect(mockedItems).toHaveBeenCalled();
  });

  it("suma el bonus de ítems y muestra campeón + ítems", async () => {
    const user = userEvent.setup();
    render(<BuildCalculator championId="Ahri" version="14.1.1" />);
    await screen.findByTestId("build-level-value");

    await user.click(screen.getByTestId("build-slot-0"));
    await screen.findByTestId("item-picker");
    await user.click(screen.getByTestId("pick-item-1036"));

    await waitFor(() => {
      expect(screen.queryByTestId("item-picker")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("stat-attackDamage-champ")).toHaveTextContent(
      "53",
    );
    expect(screen.getByTestId("stat-attackDamage-items")).toHaveTextContent(
      "+ 10",
    );

    const adRow = screen.getByTestId("stat-attackDamage-champ").closest(
      ".build-calculator__stat",
    );
    expect(adRow).not.toBeNull();
    expect(within(adRow as HTMLElement).getByText(/= 63/)).toBeInTheDocument();
  });

  it("calcula CDR desde Ability Haste de ítems", async () => {
    const user = userEvent.setup();
    render(<BuildCalculator championId="Ahri" version="14.1.1" />);
    await screen.findByTestId("build-level-value");

    await user.click(screen.getByTestId("build-slot-1"));
    await screen.findByTestId("pick-item-3108");
    await user.click(screen.getByTestId("pick-item-3108"));

    await waitFor(() => {
      expect(screen.getByTestId("build-cdr")).toHaveTextContent("AH 10");
      expect(screen.getByTestId("build-cdr")).toHaveTextContent(/CDR.*9\.09%/);
    });
  });

  it("renderiza seis ranuras de inventario", async () => {
    render(<BuildCalculator championId="Ahri" />);
    await screen.findByTestId("build-level-value");

    for (let i = 0; i < 6; i += 1) {
      expect(screen.getByTestId(`build-slot-${i}`)).toBeInTheDocument();
    }
  });
});
