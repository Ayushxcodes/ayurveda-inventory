"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type Role,
  type SessionUser,
} from "@/lib/auth/roles";
import "./users/users.css";

interface UserRow {
  userId: number;
  employeeId: string;
  fullName: string;
  username: string;
  role: Role;
  deptId: number | null;
  department: { deptCode: string; deptName: string } | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface DepartmentOption {
  deptId: number;
  deptCode: string;
  deptName: string;
}

interface UserListResponse {
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

const ROLES_ORDER: Role[] = ["requester", "hod", "procurement_officer", "admin", "super_admin"];
const PAGE_SIZE = 20;

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new Error("Unauthorized");
  }
  const payload: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      (payload as { error?: string }).error || "Request failed"
    ) as Error & { fields?: Record<string, string> };
    error.fields = (payload as { fields?: Record<string, string> }).fields;
    throw error;
  }
  return payload as T;
}

function fmtLastLogin(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UsersDashboard({ user }: { user: SessionUser }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [modal, setModal] = useState<
    { mode: "new" } | { mode: "edit"; target: UserRow } | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setPage(1);
      setQuery(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    apiRequest<{ departments: DepartmentOption[] }>("/api/departments")
      .then((data) => setDepartments(data.departments))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (query) params.set("q", query);

    apiRequest<UserListResponse>(`/api/users?${params.toString()}`)
      .then((data) => {
        if (!mounted) return;
        setRows(data.users);
        setTotal(data.total);
        setLoadError("");
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load users");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [page, query, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const reload = (message: string) => {
    setModal(null);
    setNotice(message);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  const goToPage = (next: number) => {
    setLoading(true);
    setPage(next);
  };

  return (
    <div className="um-page">
      <div className="um-header">
        <div>
          <div className="um-title">User accounts &amp; access</div>
          <div className="um-sub">
            Create accounts, assign roles and departments, and control who can sign in.
          </div>
        </div>
        <button className="um-btn um-btn-primary" onClick={() => setModal({ mode: "new" })}>
          <span className="um-plus">+</span> New user
        </button>
      </div>

      {notice && <div className="um-notice">✓ {notice}</div>}

      <div className="um-card">
        <div className="um-toolbar">
          <div className="um-search-wrap">
            <span className="um-search-icon">⌕</span>
            <input
              type="text"
              className="um-search"
              placeholder="Search by name, username, employee ID or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="um-count">
            {total} account{total === 1 ? "" : "s"}
          </div>
        </div>

        {loadError && <div className="um-error">{loadError}</div>}

        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Employee ID</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="um-empty">Loading accounts…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="um-empty">
                    {query ? `No accounts match “${query}”.` : "No user accounts yet."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.userId}>
                    <td>
                      <div className="um-user-cell">
                        <div className="um-avatar">{initials(row.fullName)}</div>
                        <div>
                          <div className="um-user-name">
                            {row.fullName}
                            {row.userId === user.userId && <span className="um-you">You</span>}
                          </div>
                          <div className="um-user-meta">@{row.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="um-mono">{row.employeeId}</td>
                    <td>
                      <span className={`um-role um-role-${row.role}`}>{ROLE_LABELS[row.role]}</span>
                    </td>
                    <td>{row.department?.deptName ?? "—"}</td>
                    <td>
                      <span className={`um-status ${row.isActive ? "um-status-active" : "um-status-inactive"}`}>
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="um-last-login">{fmtLastLogin(row.lastLoginAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="um-btn um-btn-ghost um-btn-sm"
                        onClick={() => setModal({ mode: "edit", target: row })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="um-pagination">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="um-page-actions">
            <button
              className="um-btn um-btn-ghost um-btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
            >
              ← Previous
            </button>
            <button
              className="um-btn um-btn-ghost um-btn-sm"
              disabled={page >= totalPages || loading}
              onClick={() => goToPage(page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {modal && (
        <UserFormModal
          key={modal.mode === "edit" ? `edit-${modal.target.userId}` : "new"}
          mode={modal.mode}
          target={modal.mode === "edit" ? modal.target : null}
          departments={departments}
          currentUserId={user.userId}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function UserFormModal({
  mode,
  target,
  departments,
  currentUserId,
  onClose,
  onSaved,
}: {
  mode: "new" | "edit";
  target: UserRow | null;
  departments: DepartmentOption[];
  currentUserId: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = mode === "edit";
  const isSelf = isEdit && target?.userId === currentUserId;

  const [fullName, setFullName] = useState(target?.fullName ?? "");
  const [employeeId, setEmployeeId] = useState(target?.employeeId ?? "");
  const [username, setUsername] = useState(target?.username ?? "");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(target?.email ?? "");
  const [phone, setPhone] = useState(target?.phone ?? "");
  const [role, setRole] = useState<Role>(target?.role ?? "requester");
  const [deptId, setDeptId] = useState(target?.deptId ? String(target.deptId) : "");
  const [isActive, setIsActive] = useState(target?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    setErrors({});

    try {
      if (isEdit && target) {
        const payload: Record<string, unknown> = {
          fullName,
          email,
          phone,
          role,
          deptId: deptId ? Number(deptId) : null,
          isActive,
        };
        if (password) payload.newPassword = password;

        await apiRequest(`/api/users/${target.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        onSaved(`Account for ${fullName} updated`);
      } else {
        await apiRequest("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName,
            employeeId,
            username,
            password,
            email,
            phone,
            role,
            deptId: deptId ? Number(deptId) : null,
          }),
        });
        onSaved(`Account for ${fullName} created`);
      }
    } catch (err: unknown) {
      const apiError = err as Error & { fields?: Record<string, string> };
      setFormError(apiError.message || "Request failed");
      if (apiError.fields) setErrors(apiError.fields);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="um-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="um-modal" role="dialog" aria-modal="true">
        <div className="um-modal-head">
          <div>
            <div className="um-modal-title">{isEdit ? "Edit user account" : "Create user account"}</div>
            <div className="um-modal-sub">
              {isEdit ? `@${target?.username} · ${target?.employeeId}` : "The new user signs in with the username and password you set."}
            </div>
          </div>
          <button className="um-modal-close" onClick={onClose} disabled={saving} aria-label="Close">×</button>
        </div>

        <form onSubmit={submit}>
          <div className="um-modal-body">
            {formError && <div className="um-error">{formError}</div>}

            <div className="um-form-grid">
              <div className="um-field">
                <label>Full name <span className="um-req">*</span></label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. S. Verma" autoFocus />
                {errors.fullName && <div className="um-field-error">{errors.fullName}</div>}
              </div>

              <div className="um-field">
                <label>Employee ID {!isEdit && <span className="um-req">*</span>}</label>
                {isEdit ? (
                  <input value={employeeId} readOnly className="um-readonly" />
                ) : (
                  <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value.toUpperCase())} placeholder="AIIA-0142" />
                )}
                {errors.employeeId && <div className="um-field-error">{errors.employeeId}</div>}
              </div>

              <div className="um-field">
                <label>Username {!isEdit && <span className="um-req">*</span>}</label>
                {isEdit ? (
                  <input value={username} readOnly className="um-readonly" />
                ) : (
                  <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="s.verma" autoComplete="off" />
                )}
                {errors.username && <div className="um-field-error">{errors.username}</div>}
              </div>

              <div className="um-field">
                <label>{isEdit ? "Reset password" : "Password"} {!isEdit && <span className="um-req">*</span>}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEdit ? "Leave blank to keep current" : "At least 8 characters"}
                  autoComplete="new-password"
                />
                {errors.password && <div className="um-field-error">{errors.password}</div>}
                {errors.newPassword && <div className="um-field-error">{errors.newPassword}</div>}
                {isEdit && password && (
                  <div className="um-field-hint">All of this user&apos;s sessions will be signed out.</div>
                )}
              </div>

              <div className="um-field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@aiia.gov.in" />
                {errors.email && <div className="um-field-error">{errors.email}</div>}
              </div>

              <div className="um-field">
                <label>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxx xxxxx" />
                {errors.phone && <div className="um-field-error">{errors.phone}</div>}
              </div>

              <div className="um-field">
                <label>Role <span className="um-req">*</span></label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES_ORDER.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <div className="um-field-hint">{ROLE_DESCRIPTIONS[role]}</div>
                {errors.role && <div className="um-field-error">{errors.role}</div>}
              </div>

              <div className="um-field">
                <label>
                  Department {role === "hod" && <span className="um-req">*</span>}
                </label>
                <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                  <option value="">No department</option>
                  {departments.map((d) => (
                    <option key={d.deptId} value={d.deptId}>
                      {d.deptName} ({d.deptCode})
                    </option>
                  ))}
                </select>
                {role === "hod" && <div className="um-field-hint">HODs can only see their own department&apos;s data.</div>}
                {errors.deptId && <div className="um-field-error">{errors.deptId}</div>}
              </div>
            </div>

            {isEdit && (
              <label className={`um-toggle-row${isSelf ? " um-toggle-locked" : ""}`}>
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={isSelf}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>
                  <strong>Account active</strong>
                  <small>
                    {isSelf
                      ? "You cannot deactivate your own account."
                      : "Inactive users cannot sign in, and their sessions are revoked."}
                  </small>
                </span>
              </label>
            )}
          </div>

          <div className="um-modal-foot">
            <button type="button" className="um-btn um-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="um-btn um-btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
