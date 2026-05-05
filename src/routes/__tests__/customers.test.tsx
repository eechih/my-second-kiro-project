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
    expect(screen.getByText("客戶管理")).toBeInTheDocument();
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
    expect(screen.getByText("客戶名稱")).toBeInTheDocument();
    expect(screen.getByText("聯絡人")).toBeInTheDocument();
    expect(screen.getByText("電話")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("地址")).toBeInTheDocument();
    expect(screen.getByText("操作")).toBeInTheDocument();
  });

  it("renders active/inactive toggle buttons", () => {
    renderPage();
    expect(screen.getByText("啟用中")).toBeInTheDocument();
    expect(screen.getByText("已停用")).toBeInTheDocument();
  });

  it("renders search bar with placeholder", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText("搜尋客戶名稱、聯絡人或電話..."),
    ).toBeInTheDocument();
  });

  it("shows loading state when data is loading", () => {
    mockUseCustomerList.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("calls useCustomerList with default active filter", () => {
    renderPage();
    expect(mockUseCustomerList).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });
});
