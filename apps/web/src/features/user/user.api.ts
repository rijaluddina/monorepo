import type { App } from "@repo/api";
import type { UserDTO } from "@repo/application";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { edenFetch } from "@elysiajs/eden";

const API_BASE = "http://localhost:3000";
const fetchApi = edenFetch<App>(API_BASE);

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const userApi = {
  getAll: async (page = 1, limit = 20) => {
    const { data, error } = await fetchApi("/api/users", {
      method: "GET",
      query: { page, limit }
    });
    if (error) throw new Error((error.value as any)?.message || "Request failed");
    return data as unknown as PaginatedResponse<UserDTO>;
  },

  getById: async (id: string) => {
    const { data, error } = await fetchApi("/api/users/:id", {
      method: "GET",
      params: { id }
    });
    if (error) throw new Error((error.value as any)?.message || "Request failed");
    return data as unknown as UserDTO;
  },

  create: async (body: { firstName: string; lastName: string; email: string; role?: string }) => {
    const { data, error } = await fetchApi("/api/users", {
      method: "POST",
      body: body as any
    });
    if (error) throw new Error((error.value as any)?.message || "Request failed");
    return data as unknown as UserDTO;
  },
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
    queryFn: () => userApi.getAll(page, limit),
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
