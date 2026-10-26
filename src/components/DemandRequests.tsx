'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  canCreateDemand,
  canFulfilDemand,
  canReviewDemand,
  type SessionUser,
} from '@/lib/auth/roles';
import './demand/demand.css';

type DemandStatus =
  | 'pending'
  | 'pending_hod'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'fulfilled'
  | 'cancelled';

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
  hasActiveAnomaly?: boolean;
  anomaly?: {
    alertId: number;
    title: string;
    message: string;
    severity: string;
    triggeredAt: string;
    relatedRequestId?: number | null;
  } | null;
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

interface ClientDemandAnomaly {
  type: 'unconsumed_stock' | 'open_demand';
  severity: 'critical' | 'high' | 'medium' | 'low';
  lineIndex: number;
  matchType: 'same_item' | 'similar_name';
  score: number;
  newItem: {
    itemId: number;
    itemCode: string;
    itemName: string;
    requestedQty: number;
    unit: string;
  };
  priorItem: {
    itemId: number;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
  };
  priorRequest: {
    requestId: number;
    requestNumber: string;
    status: DemandStatus;
    createdAt: string;
    fulfilledAt: string | null;
    requesterName: string;
    fulfilledQty?: number;
    consumedQty?: number;
    unconsumedQty?: number;
    unit: string;
  };
  title: string;
  message: string;
}

interface DemandAnomaly {
  alertId: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  triggeredAt: string;
  department: { deptId: number; deptCode: string; deptName: string } | null;
  item: { itemId: number; itemCode: string; itemName: string } | null;
  request: DemandRow | null;
  relatedRequest: {
    requestId: number;
    requestNumber: string;
    status: DemandStatus;
    createdAt: string;
    requesterName: string;
  } | null;
}

const STATUS_LABELS: Record<DemandStatus, string> = {
  pending: 'Pending',
  pending_hod: 'Pending HOD',
  pending_admin: 'Pending Admin',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const STATUS_ORDER: DemandStatus[] = [
  'pending',
  'approved',
  'fulfilled',
  'rejected',
  'cancelled',
];

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
    ) as Error & {
      fields?: Record<string, string>;
      code?: string;
      anomalies?: ClientDemandAnomaly[];
    };
    error.fields = (payload as { fields?: Record<string, string> }).fields;
    error.code = (payload as { code?: string }).code;
    error.anomalies = (payload as { anomalies?: ClientDemandAnomaly[] }).anomalies;
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
  const [anomalies, setAnomalies] = useState<DemandAnomaly[]>([]);
  const [anomalyError, setAnomalyError] = useState('');
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  const canCreate = canCreateDemand(user.role);
  const canReview = canReviewDemand(user.role);

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

  useEffect(() => {
    if (!canReview) return;

    let mounted = true;
    apiRequest<{ anomalies: DemandAnomaly[] }>('/api/demands/anomalies')
      .then((data) => {
        if (!mounted) return;
        setAnomalies(data.anomalies);
        setAnomalyError('');
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setAnomalyError(err instanceof Error ? err.message : 'Failed to load anomalies');
      });

    return () => {
      mounted = false;
    };
  }, [canReview, refreshKey]);

  const reload = (message: string) => {
    setShowCreate(false);
    setSelected(null);
    setNotice(message);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  const acknowledgeAnomaly = async (alertId: number) => {
    setAcknowledgingId(alertId);
    setAnomalyError('');
    try {
      await apiRequest(`/api/demands/anomalies/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge' }),
      });
      setAnomalies((prev) => prev.filter((item) => item.alertId !== alertId));
      setRefreshKey((key) => key + 1);
      setNotice('Anomaly acknowledged');
    } catch (err: unknown) {
      setAnomalyError(err instanceof Error ? err.message : 'Failed to acknowledge anomaly');
    } finally {
      setAcknowledgingId(null);
    }
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

      {canReview && (anomalies.length > 0 || anomalyError) && (
        <section className="dm-anomaly-panel">
          <div className="dm-anomaly-head">
            <div>
              <div className="dm-anomaly-title">
                <span className="dm-anomaly-mark">!</span>
                Demand anomalies
                {anomalies.length > 0 && <span className="dm-anomaly-count">{anomalies.length}</span>}
              </div>
              <div className="dm-anomaly-sub">
                New requests that overlap with recently fulfilled, unconsumed stock or open
                demands.
              </div>
            </div>
          </div>

          {anomalyError && <div className="dm-anomaly-error">{anomalyError}</div>}

          <div className="dm-anomaly-list">
            {anomalies.map((anomaly) => (
              <div className="dm-anomaly-item" key={anomaly.alertId}>
                <div className="dm-anomaly-item-main">
                  <div className="dm-anomaly-item-title">
                    <span>{anomaly.request?.requestNumber ?? anomaly.title}</span>
                    <span className={`dm-severity dm-severity-${anomaly.severity}`}>
                      {anomaly.severity}
                    </span>
                  </div>
                  <div className="dm-anomaly-message">{anomaly.message}</div>
                  <div className="dm-anomaly-meta">
                    {anomaly.department && <span>{anomaly.department.deptName}</span>}
                    {anomaly.relatedRequest && (
                      <span>
                        Related {anomaly.relatedRequest.requestNumber} ·{' '}
                        {STATUS_LABELS[anomaly.relatedRequest.status]} ·{' '}
                        {anomaly.relatedRequest.requesterName}
                      </span>
                    )}
                    <span>{fmtDateTime(anomaly.triggeredAt)}</span>
                  </div>
                </div>
                <div className="dm-anomaly-actions">
                  <button
                    className="dm-btn dm-btn-ghost dm-btn-sm"
                    onClick={() => anomaly.request && setSelected(anomaly.request)}
                    disabled={!anomaly.request}
                  >
                    View request
                  </button>
                  <button
                    className="dm-btn dm-btn-warn dm-btn-sm"
                    onClick={() => acknowledgeAnomaly(anomaly.alertId)}
                    disabled={acknowledgingId === anomaly.alertId}
                  >
                    {acknowledgingId === anomaly.alertId ? 'Saving…' : 'Acknowledge'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
                      <div className="dm-request-number">
                        {row.requestNumber}
                        {row.hasActiveAnomaly && (
                          <span
                            className="dm-table-anomaly-tag"
                            title={row.anomaly?.title || 'Active anomaly alert'}
                          >
                            ! Anomaly
                          </span>
                        )}
                      </div>
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
  const [lineAnomalies, setLineAnomalies] = useState<Record<number, string>>({});
  const [anomalyWarning, setAnomalyWarning] = useState<{
    message: string;
    anomalies: ClientDemandAnomaly[];
  } | null>(null);
  const [anomalyExplanation, setAnomalyExplanation] = useState('');
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

  const checkSequence = useRef(0);

  // Debounced inline check for potential anomalies as items and quantities are selected
  useEffect(() => {
    if (!deptId) return;
    const validLines = lines.filter((l) => Number(l.itemId) > 0 && Number(l.quantity) > 0);
    if (validLines.length === 0) return;

    const seq = ++checkSequence.current;
    const timer = setTimeout(() => {
      apiRequest<{ hasAnomalies: boolean; anomalies: ClientDemandAnomaly[] }>(
        '/api/demands/check-anomalies',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deptId: Number(deptId),
            items: validLines.map((l) => ({
              itemId: Number(l.itemId),
              quantity: Number(l.quantity),
            })),
          }),
        }
      )
        .then((data) => {
          if (seq !== checkSequence.current) return;
          if (!data.hasAnomalies) {
            setLineAnomalies({});
            return;
          }
          const map: Record<number, string> = {};
          data.anomalies.forEach((a) => {
            const matchedLine = lines.find((l) => Number(l.itemId) === a.newItem.itemId);
            if (matchedLine) {
              map[matchedLine.key] =
                a.type === 'unconsumed_stock'
                  ? `Notice: ${a.priorRequest.unconsumedQty} ${a.newItem.unit} from ${a.priorRequest.requestNumber} is still unconsumed in your department.`
                  : `Notice: Similar request ${a.priorRequest.requestNumber} (${a.priorRequest.status}) is already open.`;
            }
          });
          setLineAnomalies(map);
        })
        .catch(() => {});
    }, 350);

    return () => {
      clearTimeout(timer);
      checkSequence.current += 1;
    };
  }, [deptId, lines]);

  const updateLine = (key: number, patch: Partial<LineDraft>) => {
    setAnomalyWarning(null);
    setLineAnomalies((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    setAnomalyWarning(null);
    setLines((prev) => [...prev, { key: nextKey.current++, itemId: '', quantity: '' }]);
  };

  const removeLine = (key: number) => {
    setAnomalyWarning(null);
    setLineAnomalies((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.key !== key)));
  };

  const submitRequest = async (force = false) => {
    setFormError('');
    setErrors({});
    if (!force) {
      setAnomalyWarning(null);
      setAnomalyExplanation('');
    }

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

    if (force && !anomalyExplanation.trim()) {
      setFormError('Please enter an explanation for the HOD before submitting.');
      return;
    }

    setSaving(true);
    try {
      const data = await apiRequest<{ request: DemandRow; anomalyRaised?: boolean }>('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId: Number(deptId),
          neededBy: neededBy || null,
          justification,
          confirmAnomaly: force,
          anomalyExplanation: force ? anomalyExplanation.trim() : null,
          items: lines.map((line) => ({
            itemId: Number(line.itemId),
            quantity: Number(line.quantity),
          })),
        }),
      });
      const note = data.anomalyRaised
        ? `Request ${data.request.requestNumber} submitted with Anomaly Alert sent to HOD`
        : `Request ${data.request.requestNumber} submitted`;
      onSaved(note);
    } catch (err: unknown) {
      const apiError = err as Error & {
        fields?: Record<string, string>;
        code?: string;
        anomalies?: ClientDemandAnomaly[];
      };
      if (
        apiError.code === 'DEMAND_ANOMALY' &&
        apiError.anomalies &&
        apiError.anomalies.length > 0
      ) {
        setAnomalyWarning({
          message: apiError.message || 'Anomalies detected for this request.',
          anomalies: apiError.anomalies,
        });
        setSaving(false);
        return;
      }
      setFormError(apiError.message || 'Request failed');
      if (apiError.fields) setErrors(apiError.fields);
      setSaving(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void submitRequest(false);
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

            {anomalyWarning && (
              <div className="dm-similar-warning">
                <div className="dm-similar-head">
                  <span className="dm-similar-icon">!</span>
                  <div>
                    <div className="dm-similar-title">Demand Anomaly Detected</div>
                    <div className="dm-similar-sub">
                      {anomalyWarning.message} This request overlaps with recent unconsumed stock or open demands.
                    </div>
                  </div>
                </div>

                <div className="dm-similar-list">
                  {anomalyWarning.anomalies.map((match, idx) => (
                    <div
                      className="dm-similar-item"
                      key={`${match.priorRequest.requestId}-${match.priorItem.itemId}-${idx}`}
                    >
                      <div>
                        <div className="dm-similar-item-name">{match.newItem.itemName}</div>
                        <div className="dm-similar-item-meta">
                          {match.type === 'unconsumed_stock' ? (
                            <span>
                              Fulfilled on {fmtDate(match.priorRequest.fulfilledAt || match.priorRequest.createdAt)} ·{' '}
                              <strong style={{ color: '#b45309' }}>
                                {fmtQty(match.priorRequest.unconsumedQty ?? 0)} {match.priorRequest.unit} unconsumed
                              </strong>{' '}
                              ({fmtQty(match.priorRequest.consumedQty ?? 0)} consumed to date of{' '}
                              {fmtQty(match.priorRequest.fulfilledQty ?? 0)} fulfilled)
                            </span>
                          ) : (
                            <span>
                              {match.priorRequest.requestNumber} · {STATUS_LABELS[match.priorRequest.status]} ·{' '}
                              {fmtQty(match.priorItem.quantity)} {match.priorItem.unit} ·{' '}
                              {match.priorRequest.requesterName} · {fmtDate(match.priorRequest.createdAt)}
                            </span>
                          )}
                        </div>
                        {match.message && (
                          <div className="dm-similar-item-meta" style={{ marginTop: 2 }}>
                            {match.message}
                          </div>
                        )}
                      </div>
                      <span
                        className={`dm-match-tag${match.type === 'unconsumed_stock' ? ' dm-match-exact' : ''}`}
                      >
                        {match.type === 'unconsumed_stock' ? 'Unconsumed stock' : 'Open demand'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="dm-anomaly-explanation-block">
                  <label htmlFor="dm-anomaly-input">
                    Explanation for HOD <span className="dm-req">*</span>
                  </label>
                  <textarea
                    id="dm-anomaly-input"
                    rows={2}
                    value={anomalyExplanation}
                    onChange={(e) => setAnomalyExplanation(e.target.value)}
                    placeholder="State why additional stock is needed while previous stock remains unconsumed (e.g. reserved for upcoming surgical camp, damaged packing, emergency surge)…"
                    required
                  />
                </div>

                <div className="dm-similar-note">
                  Submitting will flag an Anomaly Alert directly to your Head of Department (HOD) for review.
                </div>
              </div>
            )}

            {options && (
              <>
                <div className="dm-form-grid">
                  <div className="dm-field">
                    <label>Department <span className="dm-req">*</span></label>
                    <select
                      value={deptId}
                      onChange={(e) => {
                        setAnomalyWarning(null);
                        setLineAnomalies({});
                        setDeptId(e.target.value);
                      }}
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
                    const lineWarning = lineAnomalies[line.key];
                    return (
                      <div className="dm-line-wrapper" key={line.key}>
                        <div className="dm-line">
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
                        {lineWarning && (
                          <div className="dm-line-anomaly-inline">
                            <span className="dm-mini-icon">!</span>
                            <span>{lineWarning}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {errors.items && <div className="dm-field-error dm-items-error">{errors.items}</div>}
              </>
            )}
          </div>

          <div className="dm-modal-foot">
            {anomalyWarning ? (
              <>
                <button
                  type="button"
                  className="dm-btn dm-btn-ghost"
                  onClick={() => setAnomalyWarning(null)}
                  disabled={saving}
                >
                  Back to edit
                </button>
                <button
                  type="button"
                  className="dm-btn dm-btn-warn"
                  onClick={() => void submitRequest(true)}
                  disabled={saving || !options || !anomalyExplanation.trim()}
                  title={!anomalyExplanation.trim() ? 'Please provide an explanation for the HOD' : undefined}
                >
                  {saving ? 'Submitting…' : 'Submit anyway & Alert HOD'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="dm-btn dm-btn-ghost" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="dm-btn dm-btn-primary" disabled={saving || !options}>
                  {saving ? 'Submitting…' : 'Submit request'}
                </button>
              </>
            )}
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
