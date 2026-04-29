import type { UserDTO } from "@repo/application";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "../../lib/api";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const userApi = {
  getAll: async (page = 1, limit = 20) => {
    const { data, error } = await api.api.users.get({
      $query: { page, limit }
    });
    if (error) throw new Error((error.value as any)?.message || "Request failed");
    return data as unknown as PaginatedResponse<UserDTO>;
  },

  getById: async (id: string) => {
    // @ts-ignore - Eden Treaty dynamic paths can be tricky with some TS versions
    const { data, error } = await api.api.users[id].get();
    if (error) throw new Error((error.value as any)?.message || "User not found");
    return data as any as UserDTO;
  },

  create: async (body: { firstName: string; lastName: string; email: string; role?: "admin" | "member" | "viewer" }) => {
    const { data, error } = await api.api.users.post(body);
    if (error) throw new Error((error.value as any)?.message || "Request failed");
    return data as any as UserDTO;
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
