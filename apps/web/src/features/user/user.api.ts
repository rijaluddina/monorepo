import type { UserDTO } from "@repo/application";

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
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? "Request failed";
    throw new Error(msg);
  }
  return data as T;
}

export const userApi = {
  getAll: (page = 1, limit = 20) =>
    request<PaginatedResponse<UserDTO>>(`/users?page=${page}&limit=${limit}`),

  getById: (id: string) => request<UserDTO>(`/users/${id}`),

  create: (body: { firstName: string; lastName: string; email: string; role?: string }) =>
    request<UserDTO>("/users", { method: "POST", body: JSON.stringify(body) }),
};
