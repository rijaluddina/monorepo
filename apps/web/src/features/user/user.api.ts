import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

const getErrorMessage = (error: unknown, fallback: string): string => {
  // biome-ignore lint/suspicious/noExplicitAny: error.value is unknown/generic from Eden
  return (error as any)?.value?.error?.message || fallback;
};

export const userApi = {
  getAll: async (page = 1, limit = 20, search?: string) => {
    const { data, error } = await api.api.v1.users.get({
      query: { page, limit, search },
    });
    if (error) {
      throw new Error(getErrorMessage(error, "Request failed"));
    }
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await api.api.v1.users({ id }).get();
    if (error) {
      throw new Error(getErrorMessage(error, "User not found"));
    }
    return data;
  },

  create: async (body: {
    firstName: string;
    lastName: string;
    email: string;
    role?: "admin" | "member" | "viewer";
  }) => {
    const { data, error } = await api.api.v1.users.post(body);
    if (error) {
      throw new Error(getErrorMessage(error, "Request failed"));
    }
    return data;
  },

  activate: async (id: string) => {
    const { error } = await api.api.v1.users({ id }).activate.patch();
    if (error) {
      throw new Error(getErrorMessage(error, "Activation failed"));
    }
  },

  deactivate: async (id: string) => {
    const { error } = await api.api.v1.users({ id }).deactivate.patch();
    if (error) {
      throw new Error(getErrorMessage(error, "Deactivation failed"));
    }
  },

  changeEmail: async (id: string, email: string) => {
    const { error } = await api.api.v1.users({ id }).email.patch({ email });
    if (error) {
      throw new Error(getErrorMessage(error, "Email update failed"));
    }
  },

  changeRole: async (id: string, role: "admin" | "member" | "viewer") => {
    const { error } = await api.api.v1.users({ id }).role.patch({ role });
    if (error) {
      throw new Error(getErrorMessage(error, "Role update failed"));
    }
  },

  delete: async (id: string) => {
    const { error } = await api.api.v1.users({ id }).delete();
    if (error) {
      throw new Error(getErrorMessage(error, "Deletion failed"));
    }
  },
};

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (page: number, limit: number, search?: string) =>
    [...userKeys.lists(), { page, limit, search }] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export const useUsers = (page = 1, limit = 10, search?: string) => {
  return useQuery({
    queryKey: userKeys.list(page, limit, search),
    queryFn: () => userApi.getAll(page, limit, search),
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
