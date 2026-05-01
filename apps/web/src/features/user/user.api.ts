import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export const userApi = {
  getAll: async (page = 1, limit = 20) => {
    const { data, error } = await api.api.users.get({
      query: { page, limit },
    });
    if (error) {
      // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
      const message = (error.value as any)?.error?.message || "Request failed";
      throw new Error(message);
    }
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await api.api.users({ id }).get();
    if (error) {
      // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
      const message = (error.value as any)?.error?.message || "User not found";
      throw new Error(message);
    }
    return data;
  },

  create: async (body: {
    firstName: string;
    lastName: string;
    email: string;
    role?: "admin" | "member" | "viewer";
  }) => {
    const { data, error } = await api.api.users.post(body);
    if (error) {
      // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
      const message = (error.value as any)?.error?.message || "Request failed";
      throw new Error(message);
    }
    return data;
  },
};

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...userKeys.lists(), { page, limit }] as const,
  details: () => [...userKeys.all, "detail"] as const,
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
    mutationFn: (body: Parameters<typeof userApi.create>[0]) =>
      userApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};
