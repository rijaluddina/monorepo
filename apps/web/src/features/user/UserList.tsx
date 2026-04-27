import { useState, useEffect, useCallback } from "react";
import type { UserDTO } from "@repo/application";
import { userApi, type PaginatedResponse } from "./user.api.js";

// ─── Create User Form ──────────────────────────────────────────────────────

interface CreateUserFormProps {
  onCreated: () => void;
}

function CreateUserForm({ onCreated }: CreateUserFormProps) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "member" as "admin" | "member" | "viewer",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await userApi.create(form);
      setForm({ firstName: "", lastName: "", email: "", role: "member" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card form-card">
      <div className="card-header">
        <span className="card-title">➕ Create User</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">✓ User created successfully!</div>}

      <form onSubmit={handleSubmit} className="form-inner">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="Alice"
              value={form.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Johnson"
              value={form.lastName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="alice@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" value={form.role} onChange={handleChange}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── User Table Row ────────────────────────────────────────────────────────

function UserRow({ user }: { user: UserDTO }) {
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <tr>
      <td>
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{user.fullName}</div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={`badge badge-${user.role}`}>{user.role}</span>
      </td>
      <td>
        <span className={`badge ${user.isActive ? "badge-active" : "badge-inactive"}`}>
          {user.isActive ? "● Active" : "○ Inactive"}
        </span>
      </td>
      <td style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}

// ─── User List ─────────────────────────────────────────────────────────────

export function UserList() {
  const [data, setData] = useState<PaginatedResponse<UserDTO> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await userApi.getAll(page, 10);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <CreateUserForm onCreated={load} />

      <div className="card">
        <div className="card-header">
          <span className="card-title">👥 Users</span>
          {data && (
            <span className="card-count">{data.total} total</span>
          )}
        </div>

        <table className="user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="loading-row">
                <td colSpan={4}>
                  <div className="spinner" />
                  Loading users…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={4}>
                  <div className="alert alert-error">{error}</div>
                </td>
              </tr>
            )}
            {!loading && !error && data?.data.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <div className="empty-state-icon">👤</div>
                    <p>No users yet. Create one above!</p>
                  </div>
                </td>
              </tr>
            )}
            {!loading && !error && data?.data.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="pagination">
            <span>Page {data.page} of {data.totalPages}</span>
            <div className="pagination-btns">
              <button
                className="btn btn-ghost"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                type="button"
              >
                ← Prev
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                type="button"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
