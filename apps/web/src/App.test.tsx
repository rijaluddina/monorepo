import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

// Mock the hooks
vi.mock("./features/user/user.api", () => ({
  useUsers: vi.fn(() => ({
    data: { data: [], total: 0, page: 1, totalPages: 0 },
    isLoading: false,
    isError: false,
  })),
  useCreateUser: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe("App", () => {
  it("renders the app title", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    expect(screen.getAllByText(/Monorepo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Production-Ready/i)).toBeInTheDocument();
  });

  it("renders architecture badges", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Clean Architecture")).toBeInTheDocument();
    expect(screen.getByText("DDD")).toBeInTheDocument();
  });
});
