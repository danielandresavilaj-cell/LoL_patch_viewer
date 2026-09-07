import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { mockAhri, mockGaren } from "./test/fixtures";

vi.mock("./api/client", () => ({
  fetchLatestPatch: vi.fn(),
  fetchChampions: vi.fn(),
  fetchChampion: vi.fn(),
}));

import {
  fetchLatestPatch,
  fetchChampions,
  fetchChampion,
} from "./api/client";

const mockedPatch = vi.mocked(fetchLatestPatch);
const mockedList = vi.mocked(fetchChampions);
const mockedDetail = vi.mocked(fetchChampion);

describe("App", () => {
  beforeEach(() => {
    mockedPatch.mockResolvedValue({
      version: "14.1.1",
      previous: "14.1.0",
      recent: ["14.1.1", "14.1.0"],
    });
    mockedList.mockResolvedValue({
      version: "14.1.1",
      count: 2,
      champions: [mockAhri, mockGaren],
    });
    mockedDetail.mockResolvedValue(mockAhri);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("muestra la marca y el buscador", async () => {
    render(<App />);
    expect(
      screen.getByText(/lol champion & patch viewer/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: /buscar campeón/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("patch-banner")).toHaveTextContent("14.1.1");
    });
  });

  it("renderiza la lista de campeones cargada", async () => {
    render(<App />);
    expect(await screen.findByText("Ahri")).toBeInTheDocument();
    expect(screen.getByText("Garen")).toBeInTheDocument();
  });

  it("filtra al buscar con debounce", async () => {
    const user = userEvent.setup();
    mockedList.mockImplementation(async (params = {}) => {
      if (params.q?.toLowerCase() === "ahri") {
        return { version: "14.1.1", count: 1, champions: [mockAhri] };
      }
      return {
        version: "14.1.1",
        count: 2,
        champions: [mockAhri, mockGaren],
      };
    });

    render(<App />);
    await screen.findByText("Garen");

    await user.type(
      screen.getByRole("searchbox", { name: /buscar campeón/i }),
      "Ahri",
    );

    await waitFor(() => {
      expect(mockedList).toHaveBeenCalledWith({ q: "Ahri" });
    });
    expect(await screen.findByText("Ahri")).toBeInTheDocument();
  });

  it("abre el detalle al seleccionar un campeón", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Ahri");

    await user.click(screen.getByRole("button", { name: /ahri/i }));

    await waitFor(() => {
      expect(mockedDetail).toHaveBeenCalledWith("Ahri", "14.1.1");
    });
    expect(
      await screen.findByRole("heading", { name: "Ahri", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/spirit realm/i)).toBeInTheDocument();
  });
});
