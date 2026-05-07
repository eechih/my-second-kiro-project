import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ListToolbar,
  type ListToolbarOption,
} from "../ListToolbar";

type StatusFilter = "all" | "active" | "inactive";
type SortField = "name" | "createdAt";

const statusOptions = [
  { value: "all", label: "全部狀態" },
  { value: "active", label: "啟用中" },
  { value: "inactive", label: "已停用" },
] as const satisfies readonly ListToolbarOption<StatusFilter>[];

const sortOptions = [
  { value: "name", label: "名稱" },
  { value: "createdAt", label: "建立日期" },
] as const satisfies readonly ListToolbarOption<SortField>[];

describe("ListToolbar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders search, selects, and actions", () => {
    render(
      <ListToolbar
        search=""
        onSearchChange={() => {}}
        totalCount={3}
        statusSelect={{
          value: "all",
          onChange: () => {},
          options: statusOptions,
          ariaLabel: "狀態篩選",
        }}
        sortSelect={{
          value: "createdAt",
          onChange: () => {},
          options: sortOptions,
          ariaLabel: "排序欄位",
        }}
        actions={<button type="button">新增</button>}
      />,
    );

    expect(screen.getByPlaceholderText("搜尋 3 筆記錄...")).toBeInTheDocument();
    expect(screen.getByText("全部狀態")).toBeInTheDocument();
    expect(screen.getByText("建立日期")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增" })).toBeInTheDocument();
  });

  it("passes debounced search changes to the caller", () => {
    vi.useFakeTimers();
    const handleSearchChange = vi.fn();

    render(
      <ListToolbar
        search=""
        onSearchChange={handleSearchChange}
        totalCount={0}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("搜尋 0 筆記錄..."), {
      target: { value: "客戶" },
    });

    expect(handleSearchChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(handleSearchChange).toHaveBeenCalledWith("客戶");
  });

  it("passes select changes to the caller", () => {
    const handleStatusChange = vi.fn();

    render(
      <ListToolbar
        search=""
        onSearchChange={() => {}}
        totalCount={0}
        statusSelect={{
          value: "all",
          onChange: handleStatusChange,
          options: statusOptions,
          ariaLabel: "狀態篩選",
        }}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "狀態篩選" }));
    fireEvent.click(screen.getByRole("option", { name: "啟用中" }));

    expect(handleStatusChange).toHaveBeenCalledWith("active");
  });
});
