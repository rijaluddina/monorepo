import type { UserDTO } from "@repo/application";
import { useState } from "react";
import {
  useActivateUser,
  useChangeUserEmail,
  useChangeUserRole,
  useCreateUser,
  useDeactivateUser,
  useDeleteUser,
  useUsers,
} from "./user.api";

// ─── Create User Form ──────────────────────────────────────────────────────

function CreateUserForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "member" as "admin" | "member" | "viewer",
  });
  const [success, setSuccess] = useState(false);
  const createUser = useCreateUser();

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    try {
      await createUser.mutateAsync(form);
      setForm({ firstName: "", lastName: "", email: "", role: "member" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      // Error is handled by useCreateUser and exposed via createUser.error
    }
  }

  return (
    <div className="card form-card">
      <div className="card-header">
        <span className="card-title">➕ Create User</span>
      </div>

      {createUser.isError && (
        <div className="alert alert-error">
          {createUser.error instanceof Error
            ? createUser.error.message
            : "Failed to create user"}
        </div>
      )}
      {success && (
        <div className="alert alert-success">✓ User created successfully!</div>
      )}

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
            <select
              id="role"
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createUser.isPending}
          >
            {createUser.isPending ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Edit User Modal ───────────────────────────────────────────────────────

interface EditUserModalProps {
  user: UserDTO;
  onClose: () => void;
}

function EditUserModal({ user, onClose }: EditUserModalProps) {
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);

  const changeEmail = useChangeUserEmail();
  const changeRole = useChangeUserRole();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (email !== user.email) {
        await changeEmail.mutateAsync({ id: user.id, email });
      }
      if (role !== user.role) {
        await changeRole.mutateAsync({ id: user.id, role });
      }
      onClose();
    } catch (err) {
      // Handled by mutation hooks
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content card">
        <div className="card-header">
          <span className="card-title">✏️ Edit User</span>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-inner">
          <div className="form-group">
            <label htmlFor={`edit-email-${user.id}`}>Email</label>
            <input
              id={`edit-email-${user.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor={`edit-role-${user.id}`}>Role</label>
            <select
              id={`edit-role-${user.id}`}
              value={role}
              onChange={(e) => setRole(e.target.value as UserDTO["role"])}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {(changeEmail.isError || changeRole.isError) && (
            <div className="alert alert-error">
              {((changeEmail.error || changeRole.error) as Error)?.message ||
                "Update failed"}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={changeEmail.isPending || changeRole.isPending}
            >
              {changeEmail.isPending || changeRole.isPending
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── User Table Row ────────────────────────────────────────────────────────

function UserRow({ user }: { user: UserDTO }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const activate = useActivateUser();
  const deactivate = useDeactivateUser();
  const deleteUser = useDeleteUser();

  const handleToggleStatus = async () => {
    if (user.isActive) {
      await deactivate.mutateAsync(user.id);
    } else {
      await activate.mutateAsync(user.id);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${user.fullName}?`)) {
      await deleteUser.mutateAsync(user.id);
    }
  };

  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

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
        <span
          className={`badge ${user.isActive ? "badge-active" : "badge-inactive"}`}
        >
          {user.isActive ? "● Active" : "○ Inactive"}
        </span>
      </td>
      <td style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
        <div className="row-actions">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setIsEditOpen(true)}
            type="button"
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleToggleStatus}
            disabled={activate.isPending || deactivate.isPending}
            type="button"
          >
            {user.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={handleDelete}
            disabled={deleteUser.isPending}
            type="button"
          >
            Delete
          </button>
        </div>
        {isEditOpen && (
          <EditUserModal user={user} onClose={() => setIsEditOpen(false)} />
        )}
      </td>
    </tr>
  );
}

// ─── User List ─────────────────────────────────────────────────────────────

export function UserList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useUsers(page, 10);

  return (
    <>
      <CreateUserForm />

      <div className="card">
        <div className="card-header">
          <span className="card-title">👥 Users</span>
          {data && <span className="card-count">{data.total} total</span>}
        </div>

        <table className="user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr className="loading-row">
                <td colSpan={4}>
                  <div className="spinner" />
                  Loading users…
                </td>
              </tr>
            )}
            {!isLoading && isError && (
              <tr>
                <td colSpan={4}>
                  <div className="alert alert-error">
                    {error instanceof Error
                      ? error.message
                      : "Failed to load users"}
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && !isError && data?.data.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <div className="empty-state-icon">👤</div>
                    <p>No users yet. Create one above!</p>
                  </div>
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              data?.data.map((user) => <UserRow key={user.id} user={user} />)}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="pagination">
            <span>
              Page {data.page} of {data.totalPages}
            </span>
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
