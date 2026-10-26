'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  canCreateDemand,
  canFulfilDemand,
  canReviewDemand,
  type SessionUser,
} from '@/lib/auth/roles';
import './demand/demand.css';

type DemandStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled';

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

interface DemandRow {
  requestId: number;
  requestNumber: string;
  status: DemandStatus;
  neededBy: string | null;
  justification: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  department: { deptCode: string; deptName: string };
  requester: { userId: number; fullName: string; username: string };
  reviewerName: string | null;
  fulfillerName: string | null;
  items: DemandItem[];
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
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const STATUS_ORDER: DemandStatus[] = ['pending', 'approved', 'fulfilled', 'rejected', 'cancelled'];

const SUBTITLES: Record<SessionUser['role'], string> = {
  super_admin: 'Demand requests across every department, with full review and fulfilment control.',
  admin: 'Review, fulfil and track demand requests across all departments.',
  procurement_officer: 'Fulfil approved demand requests once stock is ready.',
  hod: 'Requests raised for your department. Approve or reject them before procurement fulfils.',
  requester: 'Raise demand requests for your department and track their progress.',
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
  }, [query, statusFilter, refreshKey]);

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
          <div className="dm-title">Demand requests</div>
          <div className="dm-sub">{SUBTITLES[user.role]}</div>
        </div>
        {canCreate && (
          <button className="dm-btn dm-btn-primary" onClick={() => setShowCreate(true)}>
            <span className="dm-plus">+</span> New request
          </button>
        )}
      </div>

      {notice && <div className="dm-notice">✓ {notice}</div>}

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
                <th>Needed by</th>
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
                    <td className="dm-nowrap">{fmtDate(row.neededBy)}</td>
                    <td>
                      <span className={`dm-status dm-status-${row.status}`}>{STATUS_LABELS[row.status]}</span>
                    </td>
                    <td className="dm-actions-cell">
                      <button className="dm-btn dm-btn-ghost dm-btn-sm" onClick={() => setSelected(row)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nextKey = useRef(2);

  useEffect(() => {
    let mounted = true;
    apiRequest<DemandOptions>('/api/demands/options')
      .then((data) => {
        if (!mounted) return;
        setOptions(data);
        if (data.defaultDeptId) setDeptId(String(data.defaultDeptId));
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setOptionsError(err instanceof Error ? err.message : 'Failed to load catalog');
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

  const updateLine = (key: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { key: nextKey.current++, itemId: '', quantity: '' }]);
  };

  const removeLine = (key: number) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.key !== key)));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setErrors({});

    if (!deptId) {
      setFormError('Select a department for this request.');
      return;
    }

    const chosen = new Set<number>();
    for (const line of lines) {
      const itemId = Number(line.itemId);
      const quantity = Number(line.quantity);
      if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
        setFormError('Select an item and a quantity greater than zero on every line.');
        return;
      }
      if (chosen.has(itemId)) {
        setFormError('Each item can only appear once. Remove the duplicate line.');
        return;
      }
      chosen.add(itemId);
    }

    setSaving(true);
    try {
      const data = await apiRequest<{ request: DemandRow }>('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId: Number(deptId),
          neededBy: neededBy || null,
          justification,
          items: lines.map((line) => ({
            itemId: Number(line.itemId),
            quantity: Number(line.quantity),
          })),
        }),
      });
      onSaved(`Request ${data.request.requestNumber} submitted`);
    } catch (err: unknown) {
      const apiError = err as Error & { fields?: Record<string, string> };
      setFormError(apiError.message || 'Request failed');
      if (apiError.fields) setErrors(apiError.fields);
      setSaving(false);
    }
  };

  const locked = options && !options.canChooseDepartment;

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
            <div className="dm-modal-title">New demand request</div>
            <div className="dm-modal-sub">
              Requests are reviewed by your HOD and fulfilled by the procurement office.
            </div>
          </div>
          <button className="dm-modal-close" onClick={onClose} disabled={saving} aria-label="Close">×</button>
        </div>

        <form onSubmit={submit}>
          <div className="dm-modal-body">
            {formError && <div className="dm-error">{formError}</div>}
            {optionsError && <div className="dm-error">{optionsError}</div>}
            {!options && !optionsError && <div className="dm-loading-note">Loading catalog…</div>}

            {options && (
              <>
                <div className="dm-form-grid">
                  <div className="dm-field">
                    <label>Department <span className="dm-req">*</span></label>
                    <select
                      value={deptId}
                      onChange={(e) => setDeptId(e.target.value)}
                      disabled={Boolean(locked)}
                      className={locked ? 'dm-readonly' : undefined}
                    >
                      <option value="">Select department…</option>
                      {options.departments.map((dept) => (
                        <option key={dept.deptId} value={dept.deptId}>
                          {dept.deptName} ({dept.deptCode})
                        </option>
                      ))}
                    </select>
                    <div className="dm-field-hint">
                      {locked
                        ? `Requests are raised for ${user.deptName ?? 'your assigned department'}.`
                        : 'Choose the department that needs this stock.'}
                    </div>
                    {errors.deptId && <div className="dm-field-error">{errors.deptId}</div>}
                  </div>

                  <div className="dm-field">
                    <label>Needed by</label>
                    <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
                    <div className="dm-field-hint">Optional target date for the department.</div>
                    {errors.neededBy && <div className="dm-field-error">{errors.neededBy}</div>}
                  </div>
                </div>

                <div className="dm-field dm-field-block">
                  <label>Justification</label>
                  <textarea
                    rows={2}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Why is this stock needed? e.g. monthly OPD replenishment"
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

  const canReview =
    canReviewDemand(user.role) &&
    request.status === 'pending' &&
    !(user.role === 'hod' && request.requester.userId === user.userId);
  const canFulfil = canFulfilDemand(user.role) && request.status === 'approved';
  const canCancel =
    request.status === 'pending' &&
    (request.requester.userId === user.userId || user.role === 'admin' || user.role === 'super_admin');
  const hasActions = canReview || canFulfil || canCancel;

  const act = async (action: 'approve' | 'reject' | 'fulfil' | 'cancel') => {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/api/demands/${request.requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      });
      const message =
        action === 'approve'
          ? 'Request approved'
          : action === 'reject'
            ? 'Request rejected'
            : action === 'fulfil'
              ? 'Request marked fulfilled'
              : 'Request cancelled';
      onUpdated(`${request.requestNumber} — ${message.toLowerCase()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setBusy(false);
    }
  };

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
                {STATUS_LABELS[request.status]}
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
              <div className="dm-meta-label">Reviewed by</div>
              <div className="dm-meta-value">
                {request.reviewerName ? `${request.reviewerName} · ${fmtDateTime(request.reviewedAt)}` : '—'}
              </div>
            </div>
            <div>
              <div className="dm-meta-label">Fulfilled by</div>
              <div className="dm-meta-value">
                {request.fulfillerName ? `${request.fulfillerName} · ${fmtDateTime(request.fulfilledAt)}` : '—'}
              </div>
            </div>
          </div>

          <div className="dm-section-label">Items</div>
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
              <div className="dm-meta-label">Justification</div>
              <div className="dm-note-text">{request.justification}</div>
            </div>
          )}

          {request.reviewNotes && (
            <div className="dm-note-block">
              <div className="dm-meta-label">Review note</div>
              <div className="dm-note-text">{request.reviewNotes}</div>
            </div>
          )}

          {canReview && (
            <div className="dm-field dm-field-block">
              <label>Review note {request.status === 'pending' && <span className="dm-field-hint-inline">(required to reject)</span>}</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add context for the requester or procurement…"
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
            {canReview && (
              <>
                <button
                  type="button"
                  className="dm-btn dm-btn-ghost dm-btn-danger-text"
                  onClick={() => act('reject')}
                  disabled={busy || !notes.trim()}
                  title={!notes.trim() ? 'Add a review note before rejecting' : undefined}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="dm-btn dm-btn-primary"
                  onClick={() => act('approve')}
                  disabled={busy}
                >
                  {busy ? 'Saving…' : 'Approve'}
                </button>
              </>
            )}
            {canFulfil && (
              <button
                type="button"
                className="dm-btn dm-btn-primary"
                onClick={() => act('fulfil')}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Mark fulfilled'}
              </button>
            )}
          </div>
        </div>

        {!hasActions && request.status === 'rejected' && request.reviewNotes && (
          <div className="dm-foot-note">Rejected requests cannot be actioned. Raise a new request if needed.</div>
        )}
      </div>
    </div>
  );
}
