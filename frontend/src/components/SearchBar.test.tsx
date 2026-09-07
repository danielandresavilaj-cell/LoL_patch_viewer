import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "../components/SearchBar";

describe("SearchBar", () => {
  it("renderiza el campo de búsqueda con placeholder", () => {
    render(<SearchBar value="" onChange={() => undefined} />);
    expect(
      screen.getByRole("searchbox", { name: /buscar campeón/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar campeón/i)).toBeInTheDocument();
  });

  it("llama onChange al escribir", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);

    await user.type(
      screen.getByRole("searchbox", { name: /buscar campeón/i }),
      "Ahri",
    );

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith("i");
  });

  it("muestra el valor controlado", () => {
    render(<SearchBar value="Garen" onChange={() => undefined} />);
    expect(screen.getByRole("searchbox")).toHaveValue("Garen");
  });
});
