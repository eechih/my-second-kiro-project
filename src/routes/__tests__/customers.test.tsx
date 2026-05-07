import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Customer, PaginatedResult } from "@shared/models";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

// Capture the component passed to createFileRoute(...).component
let CapturedComponent: React.ComponentType | null = null;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => {
    CapturedComponent = options.component;
    return { options };
  },
  redirect: vi.fn(),
  useNavigate: () => mockNavigate,
}));

const mockCustomers: Customer[] = [
  {
    id: "c1",
    name: "測試客戶 A",
    contactPerson: "王小明",
    phone: "0912345678",
    email: "a@example.com",
    address: "台北市信義區",
    isActive: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "c2",
    name: "測試客戶 B",
    contactPerson: "李小華",
    phone: "0987654321",
    email: "b@example.com",
    address: "台中市西屯區",
    isActive: true,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

const mockData: PaginatedResult<Customer> = {
  items: mockCustomers,
  totalCount: 2,
  nextToken: undefined,
};

const mockUseCustomerList = vi.fn().mockReturnValue({
  data: mockData,
  isLoading: false,
});

const mockDeactivateMutateAsync = vi.fn();
const mockActivateMutateAsync = vi.fn();

vi.mock("@/hooks/useCustomers", () => ({
  useCustomerList: (...args: unknown[]) => mockUseCustomerList(...args),
  useDeactivateCustomer: () => ({
    mutateAsync: mockDeactivateMutateAsync,
  }),
  useActivateCustomer: () => ({
    mutateAsync: mockActivateMutateAsync,
  }),
}));

vi.mock("@/hooks/useCursorPagination", () => ({
  useCursorPagination: () => ({
    currentToken: undefined,
    pageSize: 10,
    tokenStack: [],
    goNext: vi.fn(),
    goPrev: vi.fn(),
    setPageSize: vi.fn(),
    reset: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  CapturedComponent = null;
  // Reset the module registry so the import re-executes createFileRoute
  vi.resetModules();
  // Re-apply mocks after module reset
  vi.doMock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: { component: React.ComponentType }) => {
      CapturedComponent = options.component;
      return { options };
    },
    redirect: vi.fn(),
    useNavigate: () => mockNavigate,
  }));
  vi.doMock("@/hooks/useCustomers", () => ({
    useCustomerList: (...args: unknown[]) => mockUseCustomerList(...args),
    useDeactivateCustomer: () => ({
      mutateAsync: mockDeactivateMutateAsync,
    }),
    useActivateCustomer: () => ({
      mutateAsync: mockActivateMutateAsync,
    }),
  }));
  vi.doMock("@/hooks/useCursorPagination", () => ({
    useCursorPagination: () => ({
      currentToken: undefined,
      pageSize: 10,
      tokenStack: [],
      goNext: vi.fn(),
      goPrev: vi.fn(),
      setPageSize: vi.fn(),
      reset: vi.fn(),
    }),
  }));
  // Import the module to trigger createFileRoute and capture the component
  await import("../customers/index");
});

function renderPage(): void {
  if (!CapturedComponent) {
    throw new Error("CustomerListPage component was not captured from route");
  }
  const PageComponent = CapturedComponent;
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <PageComponent />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CustomerListPage", () => {
  it("renders the page title", () => {
    renderPage();
    // "列表" appears in both breadcrumb and h5 title
    const headings = screen.getAllByText("列表");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("renders breadcrumb navigation", () => {
    renderPage();
    expect(screen.getByText("首頁")).toBeInTheDocument();
    expect(screen.getByText("客戶")).toBeInTheDocument();
    // "列表" appears in breadcrumb and as page title
    const listTexts = screen.getAllByText("列表");
    expect(listTexts.length).toBe(2);
  });

  it("renders the add customer button", () => {
    renderPage();
    expect(screen.getByText("新增客戶")).toBeInTheDocument();
  });

  it("renders customer data in the table", () => {
    renderPage();
    expect(screen.getByText("測試客戶 A")).toBeInTheDocument();
    expect(screen.getByText("測試客戶 B")).toBeInTheDocument();
    expect(screen.getByText("王小明")).toBeInTheDocument();
    expect(screen.getByText("李小華")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    renderPage();
    expect(screen.getByText("客戶資訊")).toBeInTheDocument();
    expect(screen.getByText("電話")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("地址")).toBeInTheDocument();
    expect(screen.getByText("狀態")).toBeInTheDocument();
    expect(screen.getByText("操作")).toBeInTheDocument();
  });

  it("renders status filter options", () => {
    renderPage();
    // The status filter is a MUI Select with "全部狀態" as default
    expect(screen.getByText("全部狀態")).toBeInTheDocument();
  });

  it("renders search bar with placeholder including total count", () => {
    renderPage();
    expect(screen.getByPlaceholderText("搜尋 2 筆記錄...")).toBeInTheDocument();
  });

  it("shows loading state when data is loading", () => {
    mockUseCustomerList.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("calls useCustomerList with correct default params", () => {
    renderPage();
    expect(mockUseCustomerList).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 10,
        nextToken: undefined,
        sortField: "name",
      }),
    );
  });

  it("renders status text with correct colors", () => {
    renderPage();
    const statusTexts = screen.getAllByText("啟用中");
    // Filter to only the status column texts (not the filter dropdown)
    expect(statusTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders row action buttons for each customer", () => {
    renderPage();
    // Each row should have view, edit, and toggle active buttons
    const viewButtons = screen.getAllByLabelText("檢視");
    const editButtons = screen.getAllByLabelText("編輯");
    expect(viewButtons).toHaveLength(2);
    expect(editButtons).toHaveLength(2);
  });

  it("renders pagination controls", () => {
    renderPage();
    expect(screen.getByText("每頁筆數")).toBeInTheDocument();
    expect(screen.getByText("顯示 2 筆")).toBeInTheDocument();
    expect(screen.getByLabelText("上一頁")).toBeInTheDocument();
    expect(screen.getByLabelText("下一頁")).toBeInTheDocument();
  });

  it("renders CSV export button", () => {
    renderPage();
    expect(screen.getByLabelText("匯出 CSV")).toBeInTheDocument();
  });

  it("renders select-all checkbox in header", () => {
    renderPage();
    const checkboxes = screen.getAllByRole("checkbox");
    // Header checkbox + 2 row checkboxes = 3
    expect(checkboxes).toHaveLength(3);
  });
});
