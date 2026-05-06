import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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
  pageSize: 10,
  onPageSizeChange: vi.fn(),
  hasNextPage: false,
  hasPrevPage: false,
  onNextPage: vi.fn(),
  onPrevPage: vi.fn(),
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

  it("displays pagination controls", () => {
    const data: TestRow[] = [{ id: "1", name: "商品 A" }];
    render(<DataTable {...defaultProps} data={data} totalCount={1} />);
    expect(screen.getByText("每頁筆數")).toBeInTheDocument();
    expect(screen.getByLabelText("上一頁")).toBeInTheDocument();
    expect(screen.getByLabelText("下一頁")).toBeInTheDocument();
  });

  it("disables prev button when hasPrevPage is false", () => {
    render(<DataTable {...defaultProps} hasPrevPage={false} />);
    expect(screen.getByLabelText("上一頁")).toBeDisabled();
  });

  it("disables next button when hasNextPage is false", () => {
    render(<DataTable {...defaultProps} hasNextPage={false} />);
    expect(screen.getByLabelText("下一頁")).toBeDisabled();
  });

  it("enables next button when hasNextPage is true", () => {
    const data: TestRow[] = [{ id: "1", name: "商品 A" }];
    render(
      <DataTable
        {...defaultProps}
        data={data}
        totalCount={20}
        hasNextPage={true}
      />,
    );
    expect(screen.getByLabelText("下一頁")).not.toBeDisabled();
  });

  it("enables prev button when hasPrevPage is true", () => {
    const data: TestRow[] = [{ id: "1", name: "商品 A" }];
    render(
      <DataTable
        {...defaultProps}
        data={data}
        totalCount={20}
        hasPrevPage={true}
      />,
    );
    expect(screen.getByLabelText("上一頁")).not.toBeDisabled();
  });

  it("calls onNextPage when next button is clicked", () => {
    const onNextPage = vi.fn();
    const data: TestRow[] = [{ id: "1", name: "商品 A" }];
    render(
      <DataTable
        {...defaultProps}
        data={data}
        totalCount={20}
        hasNextPage={true}
        onNextPage={onNextPage}
      />,
    );
    fireEvent.click(screen.getByLabelText("下一頁"));
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });

  it("calls onPrevPage when prev button is clicked", () => {
    const onPrevPage = vi.fn();
    const data: TestRow[] = [{ id: "1", name: "商品 A" }];
    render(
      <DataTable
        {...defaultProps}
        data={data}
        totalCount={20}
        hasPrevPage={true}
        onPrevPage={onPrevPage}
      />,
    );
    fireEvent.click(screen.getByLabelText("上一頁"));
    expect(onPrevPage).toHaveBeenCalledTimes(1);
  });

  it("calls onRowClick when a row is clicked", () => {
    const onRowClick = vi.fn();
    const data: TestRow[] = [{ id: "1", name: "商品 A" }];
    render(
      <DataTable
        {...defaultProps}
        data={data}
        totalCount={1}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByText("商品 A"));
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "商品 A" });
  });

  it("calls onRowMouseEnter when hovering a row", () => {
    const onRowMouseEnter = vi.fn();
    const data: TestRow[] = [{ id: "1", name: "商品 A" }];
    render(
      <DataTable
        {...defaultProps}
        data={data}
        totalCount={1}
        onRowMouseEnter={onRowMouseEnter}
      />,
    );
    fireEvent.mouseEnter(screen.getByText("商品 A").closest("tr")!);
    expect(onRowMouseEnter).toHaveBeenCalledWith({ id: "1", name: "商品 A" });
  });

  it("displays data count info", () => {
    const data: TestRow[] = [
      { id: "1", name: "商品 A" },
      { id: "2", name: "商品 B" },
    ];
    render(<DataTable {...defaultProps} data={data} totalCount={20} />);
    expect(screen.getByText("顯示 2 筆 / 共 20 筆")).toBeInTheDocument();
  });
});
