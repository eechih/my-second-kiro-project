import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SearchBar } from "../SearchBar";

describe("SearchBar", () => {
  it("renders without crashing", () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText("搜尋...")).toBeInTheDocument();
  });

  it("displays the provided value", () => {
    render(<SearchBar value="測試" onChange={() => {}} />);
    expect(screen.getByDisplayValue("測試")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(
      <SearchBar value="" onChange={() => {}} placeholder="搜尋客戶..." />,
    );
    expect(screen.getByPlaceholderText("搜尋客戶...")).toBeInTheDocument();
  });

  it("calls onChange after debounce delay", async () => {
    vi.useFakeTimers();
    const handleChange = vi.fn();

    render(<SearchBar value="" onChange={handleChange} debounceMs={300} />);

    const input = screen.getByPlaceholderText("搜尋...");
    fireEvent.change(input, { target: { value: "新值" } });

    expect(handleChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(handleChange).toHaveBeenCalledWith("新值");
    expect(handleChange).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("renders the search icon", () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByTestId("SearchIcon")).toBeInTheDocument();
  });
});
