'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  canCreateDemand,
  canFulfilDemand,
  canReviewDemand,
  ROLE_LABELS,
  type Role,
  type SessionUser,
} from '@/lib/auth/roles';
import './demand/demand.css';

type DemandStatus = 'pending_hod' | 'pending_admin' | 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled';

interface DemandItem {
  demandItemId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  notes: string | null;
}

interface ActivityLogItem {
  logId: number;
  actorName: string;
  actorRole: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  outOfStock: boolean;
  createdAt: string;
}

interface DemandRow {
  requestId: number;
  requestNumber: string;
  deptId: number;
  status: DemandStatus;
  stage: string;
  neededBy: string | null;
  justification: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  hodApprovedBy: number | null;
  hodApprovedAt: string | null;
  hodApproverName: string | null;
  hodNotes: string | null;
  adminApprovedBy: number | null;
  adminApprovedAt: string | null;
  adminApproverName: string | null;
  adminNotes: string | null;
  rejectedBy: number | null;
  rejectedAt: string | null;
  rejecterName: string | null;
  rejecterRole: Role | null;
  rejectionStage: string | null;
  rejectionReason: string | null;
  outOfStock: boolean;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  department: { deptCode: string; deptName: string };
  requester: { userId: number; fullName: string; username: string };
  reviewerName: string | null;
  fulfillerName: string | null;
  items: DemandItem[];
  activityLogs?: ActivityLogItem[];
}

interface GlobalLogItem {
  logId: number;
  requestId: number;
  requestNumber: string;
  departmentName: string;
  departmentCode: string;
  requesterName: string;
  currentRequestStatus: string;
  actorId: number;
  actorName: string;
  actorRole: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  outOfStock: boolean;
  createdAt: string;
}

interface DepartmentOption {
  deptId: number;
  deptCode: string;
  deptName: string;
}

interface ItemOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  unit: string;
  category: string;
}

interface DemandOptions {
  departments: DepartmentOption[];
  items: ItemOption[];
  defaultDeptId: number | null;
  canChooseDepartment: boolean;
}

const STATUS_LABELS: Record<DemandStatus, string> = {
  pending_hod: 'Pending HOD',
  pending_admin: 'Pending Admin',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const STATUS_ORDER: DemandStatus[] = [
  'pending_hod',
  'pending_admin',
  'approved',
  'fulfilled',
  'rejected',
  'cancelled',
];

const SUBTITLES: Record<SessionUser['role'], string> = {
  super_admin: 'Two-stage demand approval (HOD & Admin stock verification) across all departments.',
  admin: 'Inventory stock check and final demand sign-off across all departments.',
  procurement_officer: 'Fulfil approved demand requests and manage stock distribution.',
  hod: 'Review Stage 1 demand requests for your department before Admin stock verification.',
  requester: 'Raise demand requests for your department and track stage approval progress in real-time.',
};

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new Error('Unauthorized');
  }
  const payload: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      (payload as { error?: string }).error || 'Request failed'
    ) as Error & { fields?: Record<string, string> };
    error.fields = (payload as { fields?: Record<string, string> }).fields;
    throw error;
  }
  return payload as T;
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  return new Date(`${value}`.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtQty(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function itemsSummary(request: DemandRow): string {
  const first = request.items[0];
  if (!first) return '—';
  const extra = request.items.length - 1;
  return `${first.itemName} × ${fmtQty(first.quantity)} ${first.unit}${extra > 0 ? ` +${extra} more` : ''}`;
}

export default function DemandRequests({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<'requests' | 'logs'>('requests');
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DemandStatus>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<DemandRow | null>(null);

  const canCreate = canCreateDemand(user.role);
  const canViewLogs = user.role === 'admin' || user.role === 'super_admin' || user.role === 'hod';

  useEffect(() => {
    const next = search.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      setLoading(true);
      setQuery(next);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, query]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (activeTab !== 'requests') return;
    let mounted = true;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (statusFilter !== 'all') params.set('status', statusFilter);

    apiRequest<{ requests: DemandRow[] }>(`/api/demands?${params.toString()}`)
      .then((data) => {
        if (!mounted) return;
        setRows(data.requests);
        setLoadError('');
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load demand requests');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeTab, query, statusFilter, refreshKey]);

  const reload = (message: string) => {
    setShowCreate(false);
    setSelected(null);
    setNotice(message);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  return (
    <div className="dm-page">
      <div className="dm-header">
        <div>
          <div className="dm-title">Demand Requests & Approvals</div>
          <div className="dm-sub">{SUBTITLES[user.role]}</div>
        </div>
        {canCreate && (
          <button className="dm-btn dm-btn-primary" onClick={() => setShowCreate(true)}>
            <span className="dm-plus">+</span> New request
          </button>
        )}
      </div>

      {canViewLogs && (
        <div className="dm-subtabs">
          <button
            type="button"
            className={`dm-subtab-btn ${activeTab === 'requests' ? 'dm-subtab-active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            📋 Demand Requests ({rows.length})
          </button>
          <button
            type="button"
            className={`dm-subtab-btn ${activeTab === 'logs' ? 'dm-subtab-active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            📜 Activity & Audit Logs
          </button>
        </div>
      )}

      {notice && <div className="dm-notice">✓ {notice}</div>}

      {activeTab === 'requests' ? (
        <div className="dm-card">
          <div className="dm-toolbar">
            <div className="dm-search-wrap">
              <span className="dm-search-icon">⌕</span>
              <input
                type="text"
                className="dm-search"
                placeholder="Search by request number, requester or department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="dm-toolbar-right">
              <select
                className="dm-filter"
                value={statusFilter}
                onChange={(e) => {
                  setLoading(true);
                  setStatusFilter(e.target.value as 'all' | DemandStatus);
                }}
              >
                <option value="all">All statuses</option>
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <div className="dm-count">
                {rows.length} request{rows.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {loadError && <div className="dm-error">{loadError}</div>}

          <div className="dm-table-wrap">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Department</th>
                  <th>Raised by</th>
                  <th>Items</th>
                  <th>Current Stage</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="dm-empty">Loading requests…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="dm-empty">
                      {query || statusFilter !== 'all'
                        ? 'No requests match the current filters.'
                        : 'No demand requests yet.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.requestId}>
                      <td>
                        <div className="dm-request-number">{row.requestNumber}</div>
                        <div className="dm-request-date">{fmtDateTime(row.createdAt)}</div>
                      </td>
                      <td>
                        <div>{row.department.deptName}</div>
                        <div className="dm-muted">{row.department.deptCode}</div>
                      </td>
                      <td>
                        <div>{row.requester.fullName}</div>
                        <div className="dm-muted">@{row.requester.username}</div>
                      </td>
                      <td className="dm-items-cell" title={row.items.map((i) => `${i.itemName} × ${fmtQty(i.quantity)} ${i.unit}`).join('\n')}>
                        {itemsSummary(row)}
                      </td>
                      <td className="dm-nowrap">
                        {row.status === 'pending_hod' ? (
                          <span style={{ color: '#b45309', fontWeight: 600 }}>1/2: HOD Review</span>
                        ) : row.status === 'pending_admin' ? (
                          <span style={{ color: '#0369a1', fontWeight: 600 }}>2/2: Admin Stock Check</span>
                        ) : row.status === 'rejected' ? (
                          <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                            {row.rejectionStage === 'admin' ? 'Rejected by Admin' : 'Rejected by HOD'}
                            {row.outOfStock ? ' (Out of stock)' : ''}
                          </span>
                        ) : row.status === 'approved' ? (
                          <span style={{ color: '#166534', fontWeight: 600 }}>Approved (Ready)</span>
                        ) : row.status === 'fulfilled' ? (
                          <span style={{ color: '#115e59', fontWeight: 600 }}>Fulfilled</span>
                        ) : (
                          <span className="dm-muted">{row.status}</span>
                        )}
                      </td>
                      <td>
                        <span className={`dm-status dm-status-${row.status}`}>
                          {STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                      <td className="dm-actions-cell">
                        <button className="dm-btn dm-btn-ghost dm-btn-sm" onClick={() => setSelected(row)}>
                          View & Track
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <DemandLogsTab user={user} onSelectRequest={(req) => setSelected(req)} />
      )}

      {showCreate && (
        <NewDemandModal
          user={user}
          onClose={() => setShowCreate(false)}
          onSaved={reload}
        />
      )}

      {selected && (
        <DemandDetailModal
          key={selected.requestId}
          user={user}
          request={selected}
          onClose={() => setSelected(null)}
          onUpdated={reload}
        />
      )}
    </div>
  );
}

function DemandLogsTab({
  user,
  onSelectRequest,
}: {
  user: SessionUser;
  onSelectRequest: (req: DemandRow) => void;
}) {
  const [logs, setLogs] = useState<GlobalLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (filterAction !== 'all') params.set('action', filterAction);

    apiRequest<{ logs: GlobalLogItem[] }>(`/api/demands/logs?${params.toString()}`)
      .then((data) => {
        setLogs(data.logs);
        setError('');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(fetchLogs, 250);
    return () => clearTimeout(timer);
  }, [search, filterAction]);

  const viewFullRequest = async (requestId: number) => {
    try {
      const data = await apiRequest<{ requests: DemandRow[] }>(`/api/demands?q=${requestId}`);
      const found = data.requests.find((r) => r.requestId === requestId);
      if (found) onSelectRequest(found);
    } catch {}
  };

  return (
    <div className="dm-card">
      <div className="dm-toolbar">
        <div className="dm-search-wrap">
          <span className="dm-search-icon">⌕</span>
          <input
            type="text"
            className="dm-search"
            placeholder="Search logs by request #, actor, department, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="dm-toolbar-right">
          <select
            className="dm-filter"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="all">All Actions</option>
            <option value="CREATED">Created</option>
            <option value="HOD_APPROVED">HOD Approved</option>
            <option value="HOD_REJECTED">HOD Rejected</option>
            <option value="ADMIN_APPROVED">Admin Approved</option>
            <option value="ADMIN_REJECTED">Admin Rejected (Stock / Other)</option>
            <option value="STOCK_ISSUED">Stock Issued / Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={fetchLogs}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && <div className="dm-error">{error}</div>}

      <div className="dm-table-wrap">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Request</th>
              <th>Department</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>Status Shift</th>
              <th>Notes & Reasons</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="dm-empty">Loading audit logs…</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="dm-empty">No activity logs recorded yet.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.logId}>
                  <td className="dm-nowrap">{fmtDateTime(log.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="dm-btn dm-btn-ghost dm-btn-sm"
                      style={{ padding: '2px 7px', fontSize: '11px' }}
                      onClick={() => viewFullRequest(log.requestId)}
                    >
                      {log.requestNumber}
                    </button>
                  </td>
                  <td>
                    <div>{log.departmentName}</div>
                    <div className="dm-muted">{log.departmentCode}</div>
                  </td>
                  <td>
                    <span className={`dm-log-action-badge dm-log-${log.action}`}>
                      {log.outOfStock ? '⚠ OUT OF STOCK REJECTED' : log.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div>
                      {log.actorName}
                      <span className="dm-role-badge">{log.actorRole}</span>
                    </div>
                  </td>
                  <td className="dm-nowrap">
                    <span className="dm-muted">{log.fromStatus || '—'}</span>
                    {' ➔ '}
                    <strong>{log.toStatus}</strong>
                  </td>
                  <td style={{ maxWidth: '300px' }}>
                    {log.notes ? (
                      <span style={{ color: log.outOfStock ? '#b91c1c' : 'inherit' }}>
                        {log.notes}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface LineDraft {
  key: number;
  itemId: string;
  quantity: string;
}

function NewDemandModal({
  user,
  onClose,
  onSaved,
}: {
  user: SessionUser;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [options, setOptions] = useState<DemandOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [deptId, setDeptId] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [justification, setJustification] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ key: 1, itemId: '', quantity: '' }]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nextKey = useRef(2);

  useEffect(() => {
    let mounted = true;
    apiRequest<DemandOptions>('/api/demands/options')
      .then((data) => {
        if (!mounted) return;
        setOptions(data);
        if (data.defaultDeptId) {
          setDeptId(String(data.defaultDeptId));
        } else if (data.departments.length === 1) {
          setDeptId(String(data.departments[0].deptId));
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setOptionsError(err instanceof Error ? err.message : 'Failed to load form options');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const itemsById = useMemo(() => {
    const map = new Map<number, ItemOption>();
    options?.items.forEach((item) => map.set(item.itemId, item));
    return map;
  }, [options]);

  const addLine = () => {
    setLines((prev) => [...prev, { key: nextKey.current++, itemId: '', quantity: '' }]);
  };

  const updateLine = (key: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: number) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const payload = {
      deptId: deptId ? Number(deptId) : null,
      neededBy: neededBy || null,
      justification: justification.trim() || null,
      items: lines
        .filter((l) => l.itemId && l.quantity)
        .map((l) => ({
          itemId: Number(l.itemId),
          quantity: Number(l.quantity),
          notes: null,
        })),
    };

    try {
      const res = await apiRequest<{ request: DemandRow }>('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onSaved(`Created ${res.request.requestNumber}`);
    } catch (err: unknown) {
      const errorWithFields = err as Error & { fields?: Record<string, string> };
      if (errorWithFields.fields) {
        setErrors(errorWithFields.fields);
      } else {
        setErrors({ form: errorWithFields.message || 'Failed to submit demand request' });
      }
      setSaving(false);
    }
  };

  return (
    <div
      className="dm-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="dm-modal dm-modal-wide" role="dialog" aria-modal="true">
        <div className="dm-modal-head">
          <div>
            <div className="dm-modal-title">New Demand Request</div>
            <div className="dm-modal-sub">
              {user.role === 'hod'
                ? 'Submit a demand request directly for Admin stock verification.'
                : 'Submit a demand request for HOD review and approval.'}
            </div>
          </div>
          <button className="dm-modal-close" onClick={onClose} disabled={saving} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dm-modal-body">
            {optionsError && <div className="dm-error">{optionsError}</div>}
            {errors.form && <div className="dm-error">{errors.form}</div>}

            {!options ? (
              <div className="dm-loading-note">Loading form…</div>
            ) : (
              <>
                <div className="dm-form-grid">
                  <div className="dm-field">
                    <label>Department</label>
                    {options.canChooseDepartment ? (
                      <select value={deptId} onChange={(e) => setDeptId(e.target.value)} required>
                        <option value="">Select department…</option>
                        {options.departments.map((d) => (
                          <option key={d.deptId} value={d.deptId}>
                            {d.deptName} ({d.deptCode})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="dm-readonly"
                        readOnly
                        value={
                          options.departments.find((d) => d.deptId === Number(deptId))?.deptName ||
                          user.deptCode ||
                          '—'
                        }
                      />
                    )}
                    {errors.deptId && <div className="dm-field-error">{errors.deptId}</div>}
                  </div>

                  <div className="dm-field">
                    <label>Needed by date</label>
                    <input
                      type="date"
                      value={neededBy}
                      onChange={(e) => setNeededBy(e.target.value)}
                    />
                    {errors.neededBy && <div className="dm-field-error">{errors.neededBy}</div>}
                  </div>
                </div>

                <div className="dm-field dm-field-block">
                  <label>Justification</label>
                  <textarea
                    rows={2}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Why is this stock needed? e.g. weekly clinic replenishment"
                  />
                  {errors.justification && <div className="dm-field-error">{errors.justification}</div>}
                </div>

                <div className="dm-lines-head">
                  <div className="dm-section-label">Requested items</div>
                  <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={addLine}>
                    + Add item
                  </button>
                </div>

                <div className="dm-lines">
                  <div className="dm-line dm-line-head">
                    <span>Item</span>
                    <span>Quantity</span>
                    <span>Unit</span>
                    <span />
                  </div>
                  {lines.map((line) => {
                    const item = itemsById.get(Number(line.itemId));
                    return (
                      <div className="dm-line" key={line.key}>
                        <select
                          value={line.itemId}
                          onChange={(e) => updateLine(line.key, { itemId: e.target.value })}
                        >
                          <option value="">Select item…</option>
                          {options.items.map((option) => (
                            <option key={option.itemId} value={option.itemId}>
                              {option.itemName} ({option.itemCode})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                          placeholder="0"
                        />
                        <div className="dm-unit">{item?.unit ?? '—'}</div>
                        <button
                          type="button"
                          className="dm-line-remove"
                          onClick={() => removeLine(line.key)}
                          disabled={lines.length === 1}
                          aria-label="Remove item"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                {errors.items && <div className="dm-field-error dm-items-error">{errors.items}</div>}
              </>
            )}
          </div>

          <div className="dm-modal-foot">
            <button type="button" className="dm-btn dm-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="dm-btn dm-btn-primary" disabled={saving || !options}>
              {saving ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DemandDetailModal({
  user,
  request,
  onClose,
  onUpdated,
}: {
  user: SessionUser;
  request: DemandRow;
  onClose: () => void;
  onUpdated: (message: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Stage 1 review (HOD)
  const isDeptHod = user.role === 'hod' && user.deptId === request.deptId;
  const isSelfRequested = request.requester.userId === user.userId;
  const canHodReview =
    (user.role === 'super_admin' || (isDeptHod && !isSelfRequested)) &&
    (request.status === 'pending_hod' || request.status === 'pending');

  // Stage 2 review (Admin Stock Verification)
  const canAdminReview =
    (user.role === 'admin' || user.role === 'super_admin') &&
    (request.status === 'pending_admin' || (request.status === 'pending' && user.role === 'super_admin'));

  // Fulfilment
  const canFulfil = canFulfilDemand(user.role) && request.status === 'approved';

  // Cancellation
  const canCancel =
    (request.status === 'pending_hod' || request.status === 'pending_admin' || request.status === 'pending') &&
    (request.requester.userId === user.userId || user.role === 'admin' || user.role === 'super_admin');

  const act = async (action: string, outOfStockFlag = false) => {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/api/demands/${request.requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes, outOfStock: outOfStockFlag }),
      });
      let message = 'Request updated';
      if (action.includes('approve')) message = 'Request approved';
      else if (action.includes('reject')) message = outOfStockFlag ? 'Request rejected (Out of Stock)' : 'Request rejected';
      else if (action === 'fulfil') message = 'Request marked fulfilled';
      else if (action === 'cancel') message = 'Request cancelled';

      onUpdated(`${request.requestNumber} — ${message}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setBusy(false);
    }
  };

  // Determine Stepper states
  const isHodDone = Boolean(request.hodApprovedBy) || request.status === 'pending_admin' || request.status === 'approved' || request.status === 'fulfilled';
  const isHodRejected = request.status === 'rejected' && request.rejectionStage === 'hod';
  const isHodActive = request.status === 'pending_hod' || request.status === 'pending';

  const isAdminDone = Boolean(request.adminApprovedBy) || request.status === 'approved' || request.status === 'fulfilled';
  const isAdminRejected = request.status === 'rejected' && request.rejectionStage === 'admin';
  const isAdminActive = request.status === 'pending_admin';

  const isFulfilled = request.status === 'fulfilled';

  return (
    <div
      className="dm-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="dm-modal dm-modal-wide" role="dialog" aria-modal="true">
        <div className="dm-modal-head">
          <div>
            <div className="dm-modal-title-row">
              <span className="dm-modal-title">{request.requestNumber}</span>
              <span className={`dm-status dm-status-${request.status}`}>
                {STATUS_LABELS[request.status] || request.status}
              </span>
            </div>
            <div className="dm-modal-sub">
              Submitted {fmtDateTime(request.createdAt)} by {request.requester.fullName}
            </div>
          </div>
          <button className="dm-modal-close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
        </div>

        <div className="dm-modal-body">
          {error && <div className="dm-error">{error}</div>}

          {/* Workflow Stepper */}
          <div className="dm-stepper">
            {/* Step 1: Request */}
            <div className="dm-step-item dm-step-done">
              <div className="dm-step-circle">✓</div>
              <div className="dm-step-line" />
              <div className="dm-step-title">1. Requested</div>
              <div className="dm-step-sub">{request.requester.fullName}</div>
            </div>

            {/* Step 2: HOD Review */}
            <div
              className={`dm-step-item ${
                isHodRejected ? 'dm-step-rejected' : isHodDone ? 'dm-step-done' : isHodActive ? 'dm-step-active' : ''
              }`}
            >
              <div className="dm-step-circle">
                {isHodRejected ? '✕' : isHodDone ? '✓' : '2'}
              </div>
              <div className="dm-step-line" />
              <div className="dm-step-title">2. HOD Review</div>
              <div className="dm-step-sub">
                {isHodRejected
                  ? `Rejected by ${request.rejecterName || 'HOD'}`
                  : isHodDone
                  ? `Approved (${request.hodApproverName || 'HOD'})`
                  : isHodActive
                  ? 'Waiting for HOD'
                  : 'Pending'}
              </div>
            </div>

            {/* Step 3: Admin Stock Check */}
            <div
              className={`dm-step-item ${
                isAdminRejected ? 'dm-step-rejected' : isAdminDone ? 'dm-step-done' : isAdminActive ? 'dm-step-active' : ''
              }`}
            >
              <div className="dm-step-circle">
                {isAdminRejected ? '✕' : isAdminDone ? '✓' : '3'}
              </div>
              <div className="dm-step-line" />
              <div className="dm-step-title">3. Admin Stock Check</div>
              <div className="dm-step-sub">
                {isAdminRejected
                  ? request.outOfStock
                    ? 'Out of Stock'
                    : 'Rejected by Admin'
                  : isAdminDone
                  ? `In Stock (${request.adminApproverName || 'Admin'})`
                  : isAdminActive
                  ? 'Checking Inventory'
                  : 'Waiting for Step 2'}
              </div>
            </div>

            {/* Step 4: Issue / Fulfilment */}
            <div className={`dm-step-item ${isFulfilled ? 'dm-step-done' : ''}`}>
              <div className="dm-step-circle">{isFulfilled ? '✓' : '4'}</div>
              <div className="dm-step-title">4. Issue & Fulfil</div>
              <div className="dm-step-sub">
                {isFulfilled ? `Issued by ${request.fulfillerName || 'Store'}` : 'Pending issue'}
              </div>
            </div>
          </div>

          {/* Rejection Alert Banner if Rejected */}
          {request.status === 'rejected' && (
            <div className="dm-rejection-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <div className="dm-rejection-title">
                  <span>
                    Request Rejected at{' '}
                    {request.rejectionStage === 'admin' ? 'Stage 2 (Admin Stock Check)' : 'Stage 1 (HOD Review)'}
                  </span>
                  {request.outOfStock && (
                    <span className="dm-out-of-stock-badge">⚠ OUT OF STOCK</span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>
                  Rejected by: <strong>{request.rejecterName || 'Reviewer'}</strong>{' '}
                  {request.rejecterRole ? `(${ROLE_LABELS[request.rejecterRole]})` : ''} on{' '}
                  {fmtDateTime(request.rejectedAt)}
                </div>
                <div className="dm-rejection-reason">
                  <strong>Reason:</strong> {request.rejectionReason || request.reviewNotes || 'No reason provided.'}
                </div>
              </div>
            </div>
          )}

          <div className="dm-meta-grid">
            <div>
              <div className="dm-meta-label">Department</div>
              <div className="dm-meta-value">{request.department.deptName} ({request.department.deptCode})</div>
            </div>
            <div>
              <div className="dm-meta-label">Needed by</div>
              <div className="dm-meta-value">{fmtDate(request.neededBy)}</div>
            </div>
            <div>
              <div className="dm-meta-label">HOD Sign-off</div>
              <div className="dm-meta-value">
                {request.hodApproverName ? (
                  <span style={{ color: '#166534', fontWeight: 500 }}>
                    ✓ {request.hodApproverName} · {fmtDateTime(request.hodApprovedAt)}
                  </span>
                ) : (
                  'Pending Stage 1'
                )}
              </div>
            </div>
            <div>
              <div className="dm-meta-label">Admin Stock Verification</div>
              <div className="dm-meta-value">
                {request.adminApproverName ? (
                  <span style={{ color: '#0369a1', fontWeight: 500 }}>
                    ✓ In Stock & Approved by {request.adminApproverName} · {fmtDateTime(request.adminApprovedAt)}
                  </span>
                ) : request.outOfStock ? (
                  <span style={{ color: '#b91c1c', fontWeight: 600 }}>⚠ Out of Stock in Central Store</span>
                ) : (
                  'Pending Stage 2'
                )}
              </div>
            </div>
          </div>

          <div className="dm-section-label">Requested items</div>
          <div className="dm-detail-items">
            <div className="dm-detail-item dm-detail-item-head">
              <span>Item</span>
              <span>Quantity</span>
            </div>
            {request.items.map((line) => (
              <div className="dm-detail-item" key={line.demandItemId}>
                <div>
                  <div className="dm-detail-item-name">{line.itemName}</div>
                  <div className="dm-muted">{line.itemCode} · {line.category}</div>
                  {line.notes && <div className="dm-detail-item-note">{line.notes}</div>}
                </div>
                <div className="dm-detail-qty">{fmtQty(line.quantity)} {line.unit}</div>
              </div>
            ))}
          </div>

          {request.justification && (
            <div className="dm-note-block">
              <div className="dm-meta-label">Requester Justification</div>
              <div className="dm-note-text">{request.justification}</div>
            </div>
          )}

          {/* Admin Stock Verification Box */}
          {canAdminReview && (
            <div className="dm-stock-review-card">
              <h4>📦 Stage 2: Central Inventory Stock Verification</h4>
              <p>
                Verify available inventory for this department. If stock is depleted, you can reject with{' '}
                <strong>&quot;Out of Stock&quot;</strong>, notifying requester, HOD, and procurement.
              </p>
            </div>
          )}

          {/* Review note input */}
          {(canHodReview || canAdminReview) && (
            <div className="dm-field dm-field-block" style={{ marginTop: '14px' }}>
              <label>
                Decision remarks / rejection reason{' '}
                <span className="dm-field-hint-inline">(mandatory if rejecting for non-stock reason)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  canAdminReview
                    ? 'e.g. Stock verified in batch B-402, approved for immediate issue...'
                    : 'e.g. Department approval granted for monthly OPD requirements...'
                }
              />
            </div>
          )}
        </div>

        <div className="dm-modal-foot dm-modal-foot-split">
          <div>
            {canCancel &&
              (confirmCancel ? (
                <button
                  type="button"
                  className="dm-btn dm-btn-danger"
                  onClick={() => act('cancel')}
                  disabled={busy}
                >
                  {busy ? 'Cancelling…' : 'Confirm cancel'}
                </button>
              ) : (
                <button
                  type="button"
                  className="dm-btn dm-btn-ghost dm-btn-danger-text"
                  onClick={() => setConfirmCancel(true)}
                  disabled={busy}
                >
                  Cancel request
                </button>
              ))}
          </div>

          <div className="dm-foot-actions">
            <button type="button" className="dm-btn dm-btn-ghost" onClick={onClose} disabled={busy}>
              Close
            </button>

            {/* Stage 1: HOD Review Actions */}
            {canHodReview && (
              <>
                <button
                  type="button"
                  className="dm-btn dm-btn-ghost dm-btn-danger-text"
                  onClick={() => act('hod_reject')}
                  disabled={busy || !notes.trim()}
                  title={!notes.trim() ? 'Add a reason before rejecting' : undefined}
                >
                  HOD Reject
                </button>
                <button
                  type="button"
                  className="dm-btn dm-btn-primary"
                  onClick={() => act('hod_approve')}
                  disabled={busy}
                >
                  {busy ? 'Processing…' : 'HOD Approve ➔ Send to Admin'}
                </button>
              </>
            )}

            {/* Stage 2: Admin Stock Review Actions */}
            {canAdminReview && (
              <>
                <button
                  type="button"
                  className="dm-btn dm-btn-danger"
                  onClick={() => act('admin_reject', true)}
                  disabled={busy}
                  title="Reject due to no inventory in central store"
                >
                  {busy ? 'Rejecting…' : '⚠ Reject: Out of Stock'}
                </button>
                <button
                  type="button"
                  className="dm-btn dm-btn-ghost dm-btn-danger-text"
                  onClick={() => act('admin_reject', false)}
                  disabled={busy || !notes.trim()}
                  title={!notes.trim() ? 'Add a reason before rejecting' : undefined}
                >
                  Reject (Other Reason)
                </button>
                <button
                  type="button"
                  className="dm-btn dm-btn-primary"
                  onClick={() => act('admin_approve')}
                  disabled={busy}
                >
                  {busy ? 'Approving…' : '✓ In Stock — Final Approve'}
                </button>
              </>
            )}

            {/* Stage 3: Fulfilment */}
            {canFulfil && (
              <button
                type="button"
                className="dm-btn dm-btn-primary"
                onClick={() => act('fulfil')}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Mark Fulfilled / Issue Stock'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
