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

  activate: async (id: string) => {
    const { error } = await api.api.users({ id }).activate.patch();
    if (error) {
      // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
      const message =
        (error.value as any)?.error?.message || "Activation failed";
      throw new Error(message);
    }
  },

  deactivate: async (id: string) => {
    const { error } = await api.api.users({ id }).deactivate.patch();
    if (error) {
      // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
      const message =
        (error.value as any)?.error?.message || "Deactivation failed";
      throw new Error(message);
    }
  },

  changeEmail: async (id: string, email: string) => {
    const { error } = await api.api.users({ id }).email.patch({ email });
    if (error) {
      // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
      const message =
        (error.value as any)?.error?.message || "Email update failed";
      throw new Error(message);
    }
  },

  changeRole: async (id: string, role: "admin" | "member" | "viewer") => {
    const { error } = await api.api.users({ id }).role.patch({ role });
    if (error) {
      // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
      const message =
        (error.value as any)?.error?.message || "Role update failed";
      throw new Error(message);
    }
  },

  delete: async (id: string) => {
    const { error } = await api.api.users({ id }).delete();
    if (error) {
      // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
      const message = (error.value as any)?.error?.message || "Deletion failed";
      throw new Error(message);
    }
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

export const useActivateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useDeactivateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useChangeUserEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      userApi.changeEmail(id, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useChangeUserRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      role,
    }: { id: string; role: "admin" | "member" | "viewer" }) =>
      userApi.changeRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};
