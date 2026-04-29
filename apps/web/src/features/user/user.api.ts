import type { UserDTO } from "@repo/application";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = "/api";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  const contentType = res.headers.get("content-type");
  let data: any;

  try {
    if (contentType?.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
  } catch (e) {
    data = await res.text();
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data !== null
        ? (data as any).error?.message || (data as any).message
        : data;
    throw new Error(msg || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const userApi = {
  getAll: (page = 1, limit = 20, signal?: AbortSignal) =>
    request<PaginatedResponse<UserDTO>>(`/users?page=${page}&limit=${limit}`, { signal }),

  getById: (id: string, signal?: AbortSignal) => 
    request<UserDTO>(`/users/${id}`, { signal }),

  create: (body: { firstName: string; lastName: string; email: string; role?: string }, signal?: AbortSignal) =>
    request<UserDTO>("/users", { method: "POST", body: JSON.stringify(body), signal }),
};

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (page: number, limit: number) => [...userKeys.lists(), { page, limit }] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export const useUsers = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: userKeys.list(page, limit),
    queryFn: ({ signal }) => userApi.getAll(page, limit, signal),
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof userApi.create>[0]) => userApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};
