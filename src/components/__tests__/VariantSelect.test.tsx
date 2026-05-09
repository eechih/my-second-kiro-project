import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VariantSelect } from "../VariantSelect";
import type { ProductVariant } from "@shared/models/product";

const mockVariants: ProductVariant[] = [
  {
    id: "v1",
    label: "黑 L",
    priceOffset: null,
    costOffset: null,
  },
  {
    id: "v2",
    label: "紅 M",
    priceOffset: null,
    costOffset: null,
  },
];

describe("VariantSelect", () => {
  it("renders without crashing", () => {
    render(
      <VariantSelect
        productId="p1"
        variants={mockVariants}
        value={null}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("規格組合 *")).toBeInTheDocument();
  });

  it("displays placeholder text when no value is selected", () => {
    render(
      <VariantSelect
        productId="p1"
        variants={mockVariants}
        value={null}
        onChange={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText("請選取規格組合")).toBeInTheDocument();
  });

  it("displays error message when error prop is provided", () => {
    render(
      <VariantSelect
        productId="p1"
        variants={mockVariants}
        value={null}
        onChange={() => {}}
        error="請選取規格組合"
      />,
    );

    expect(screen.getByText("請選取規格組合")).toBeInTheDocument();
  });

  it("displays selected variant label", () => {
    render(
      <VariantSelect
        productId="p1"
        variants={mockVariants}
        value={mockVariants[0]!}
        onChange={() => {}}
      />,
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("黑 L");
  });

  it("is disabled when disabled prop is true", () => {
    render(
      <VariantSelect
        productId="p1"
        variants={mockVariants}
        value={null}
        onChange={() => {}}
        disabled
      />,
    );

    const input = screen.getByRole("combobox");
    expect(input).toBeDisabled();
  });
});
