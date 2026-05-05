import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DataTable } from "../DataTable";
import type { ColumnDef } from "@tanstack/react-table";

interface TestRow {
  id: string;
  name: string;
}

const columns: ColumnDef<TestRow, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "名稱" },
];

const defaultProps = {
  columns,
  data: [] as TestRow[],
  totalCount: 0,
  page: 0,
  pageSize: 10,
  onPageChange: () => {},
  onPageSizeChange: () => {},
  isLoading: false,
};

describe("DataTable", () => {
  it("renders without crashing", () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText("暫無資料")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("名稱")).toBeInTheDocument();
  });

  it("renders data rows", () => {
    const data: TestRow[] = [
      { id: "1", name: "商品 A" },
      { id: "2", name: "商品 B" },
    ];
    render(<DataTable {...defaultProps} data={data} totalCount={2} />);
    expect(screen.getByText("商品 A")).toBeInTheDocument();
    expect(screen.getByText("商品 B")).toBeInTheDocument();
  });

  it("shows loading indicator when isLoading is true", () => {
    render(<DataTable {...defaultProps} isLoading={true} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("暫無資料")).not.toBeInTheDocument();
  });

  it("displays pagination info", () => {
    const data: TestRow[] = [{ id: "1", name: "商品 A" }];
    render(<DataTable {...defaultProps} data={data} totalCount={1} />);
    expect(screen.getByText("每頁筆數")).toBeInTheDocument();
  });
});
