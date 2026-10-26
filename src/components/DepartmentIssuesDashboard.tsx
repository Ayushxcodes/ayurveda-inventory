'use client';

import React, { useState, useEffect } from 'react';
import type { SessionUser } from '@/lib/auth/roles';
import './department-issues/dept-issues.css';

interface Department {
  deptId: number;
  deptCode: string;
  deptName: string;
  floorLocation?: string | null;
}

interface IssueRecord {
  type: 'DEMAND_FULFILLED' | 'STOCK_ISSUE';
  referenceNumber: string;
  quantity: number;
  date: string;
  authorizedBy: string;
  purpose?: string;
  notes?: string;
}

interface HoldingItem {
  itemId: number;
  itemCode: string;
  itemName: string;
  category: string;
  subCategory: string | null;
  unit: string;
  deptId: number;
  deptName: string;
  deptCode: string;
  totalIssued: number;
  firstIssuedAt: string | null;
  lastIssuedAt: string | null;
  records: IssueRecord[];
}

interface TimelineRecord extends IssueRecord {
  itemId: number;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  deptId: number;
  deptName: string;
  deptCode: string;
}

interface KpiData {
  totalHoldingsCount: number;
  capexHoldingsCount: number;
  capexTotalUnits: number;
  opexHoldingsCount: number;
  opexTotalUnits: number;
  totalDispatchesCount: number;
}

export default function DepartmentIssuesDashboard({ user }: { user: SessionUser }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    user.deptId ? String(user.deptId) : 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CAPEX' | 'OPEX'>('ALL');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'holdings' | 'timeline'>('holdings');

  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineRecord[]>([]);
  const [kpi, setKpi] = useState<KpiData>({
    totalHoldingsCount: 0,
    capexHoldingsCount: 0,
    capexTotalUnits: 0,
    opexHoldingsCount: 0,
    opexTotalUnits: 0,
    totalDispatchesCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Direct Issue Modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [modalItemCode, setModalItemCode] = useState('');
  const [modalDeptId, setModalDeptId] = useState<string>(
    user.deptId ? String(user.deptId) : '1'
  );
  const [modalQty, setModalQty] = useState('');
  const [modalPurpose, setModalPurpose] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);

  const canIssue = user.role === 'super_admin' || user.role === 'admin' || user.role === 'hod';
  const isDeptLocked = (user.role === 'hod' || user.role === 'requester') && Boolean(user.deptId);

  useEffect(() => {
    let cancelled = false;
    const fetchHoldings = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedDeptId !== 'all') params.set('deptId', selectedDeptId);
        if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
        if (search.trim()) params.set('q', search.trim());

        const res = await fetch(`/api/department-issues?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setDepartments(data.departments || []);
        setHoldings(data.holdings || []);
        setTimeline(data.timeline || []);
        if (data.kpi) setKpi(data.kpi);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHoldings();
    return () => {
      cancelled = true;
    };
  }, [selectedDeptId, categoryFilter, search, refreshKey]);

  const toggleExpand = (key: string) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDirectIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalBusy(true);
    setModalError('');
    try {
      const res = await fetch('/api/department-issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          itemCode: modalItemCode.trim(),
          deptId: Number(modalDeptId),
          quantity: Number(modalQty),
          purpose: modalPurpose.trim() || undefined,
          notes: modalNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to issue item');
      }
      setShowIssueModal(false);
      setNotice(data.message || 'Stock successfully issued to department');
      setModalItemCode('');
      setModalQty('');
      setModalPurpose('');
      setModalNotes('');
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setModalBusy(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="dept-page">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="dept-header">
        <div className="dept-title-group">
          <div className="dept-title-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="9 22 9 12 15 12 15 22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="dept-title">Department Issues &amp; Holdings</h1>
            <div className="dept-subtitle">
              {isDeptLocked
                ? `Active equipment & stock issued internally to ${user.deptName || 'your department'}`
                : 'Hospital-wide internal department distribution and equipment registry'}
            </div>
          </div>
        </div>

        {canIssue && (
          <button className="dept-btn-issue" onClick={() => setShowIssueModal(true)}>
            <span>+</span> Issue to Department
          </button>
        )}
      </div>

      {notice && <div className="dept-alert-success">✓ {notice}</div>}

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="dept-kpi-grid">
        <div className="dept-kpi-card kpi-capex">
          <div className="dept-kpi-label">CAPEX Machinery in Depts</div>
          <div className="dept-kpi-value">{kpi.capexTotalUnits}</div>
          <div className="dept-kpi-sub">
            <span>{kpi.capexHoldingsCount} equipment types deployed</span>
          </div>
        </div>

        <div className="dept-kpi-card kpi-opex">
          <div className="dept-kpi-label">OPEX Stock Issued</div>
          <div className="dept-kpi-value">{kpi.opexTotalUnits}</div>
          <div className="dept-kpi-sub">
            <span>{kpi.opexHoldingsCount} consumable batches in use</span>
          </div>
        </div>

        <div className="dept-kpi-card kpi-total">
          <div className="dept-kpi-label">Active Item Holdings</div>
          <div className="dept-kpi-value">{kpi.totalHoldingsCount}</div>
          <div className="dept-kpi-sub">
            <span>Across {selectedDeptId === 'all' ? `${departments.length} departments` : 'selected department'}</span>
          </div>
        </div>

        <div className="dept-kpi-card kpi-dispatches">
          <div className="dept-kpi-label">Total Dispatch Vouchers</div>
          <div className="dept-kpi-value">{kpi.totalDispatchesCount}</div>
          <div className="dept-kpi-sub">
            <span>Fulfilled demands &amp; stock issues</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar & Filters ─────────────────────────────────── */}
      <div className="dept-toolbar">
        <div className="dept-toolbar-left">
          {/* Department Selector */}
          <div className="dept-select-wrap">
            <span className="dept-select-label">Department:</span>
            {isDeptLocked ? (
              <span className="dept-table-tag demand" style={{ fontSize: 13, padding: '6px 12px' }}>
                🏢 {user.deptName || 'Your Department'}
              </span>
            ) : (
              <select
                className="dept-select"
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
              >
                <option value="all">🏢 All Hospital Departments</option>
                {departments.map((d) => (
                  <option key={d.deptId} value={String(d.deptId)}>
                    {d.deptName} ({d.deptCode})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Category Chips */}
          <div className="dept-category-chips">
            <button
              className={`dept-chip ${categoryFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('ALL')}
            >
              All Items
            </button>
            <button
              className={`dept-chip ${categoryFilter === 'CAPEX' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('CAPEX')}
            >
              ⚙ CAPEX Assets
            </button>
            <button
              className={`dept-chip ${categoryFilter === 'OPEX' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('OPEX')}
            >
              🌿 OPEX Supplies
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="dept-search-wrap">
          <span className="dept-search-icon">⌕</span>
          <input
            type="text"
            className="dept-search-input"
            placeholder="Search item, code, or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Sub-tabs ─────────────────────────────────────────── */}
      <div className="dept-subtabs">
        <button
          className={`dept-subtab ${activeTab === 'holdings' ? 'active' : ''}`}
          onClick={() => setActiveTab('holdings')}
        >
          📦 Department Holdings ({holdings.length})
        </button>
        <button
          className={`dept-subtab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          📜 Dispatch &amp; Issue Ledger ({timeline.length})
        </button>
      </div>

      {/* ── View 1: Holdings Grid ─────────────────────────────── */}
      {activeTab === 'holdings' && (
        <>
          {loading ? (
            <div className="dept-empty">Loading department holdings…</div>
          ) : holdings.length === 0 ? (
            <div className="dept-empty">
              <div className="dept-empty-icon">📦</div>
              <div className="dept-empty-title">No items issued to this department yet</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                When demand requests are fulfilled or items are issued from central inventory, they will appear here.
              </p>
            </div>
          ) : (
            <div className="dept-holdings-grid">
              {holdings.map((h) => {
                const cardKey = `${h.deptId}-${h.itemId}`;
                const isExpanded = Boolean(expandedCards[cardKey]);
                return (
                  <div className="dept-holding-card" key={cardKey}>
                    <div className="dept-card-top">
                      <div>
                        <div className="dept-item-code">{h.itemCode}</div>
                        <div className="dept-item-name">{h.itemName}</div>
                      </div>
                      <span className={`dept-badge ${h.category === 'CAPEX' ? 'capex' : 'opex'}`}>
                        {h.category}
                      </span>
                    </div>

                    <div className="dept-holding-metrics">
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CURRENT HOLDING</div>
                        <span className="dept-qty-val">{h.totalIssued}</span>
                        <span className="dept-qty-unit">{h.unit}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>LOCATION</div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                          {h.deptName}
                        </span>
                      </div>
                    </div>

                    <div className="dept-holding-meta">
                      <div className="dept-meta-row">
                        <span className="dept-meta-label">Department:</span>
                        <span style={{ fontWeight: 600 }}>{h.deptName} ({h.deptCode})</span>
                      </div>
                      <div className="dept-meta-row">
                        <span className="dept-meta-label">Latest Allocation:</span>
                        <span>{formatDate(h.lastIssuedAt)}</span>
                      </div>
                      <div className="dept-meta-row">
                        <span className="dept-meta-label">Dispatches:</span>
                        <span>{h.records.length} voucher{h.records.length === 1 ? '' : 's'}</span>
                      </div>
                    </div>

                    {/* Expandable Dispatches Breakdown */}
                    <button
                      className="dept-records-toggle"
                      onClick={() => toggleExpand(cardKey)}
                    >
                      <span>{isExpanded ? '▲ Hide Dispatches' : '▼ View Dispatch History'}</span>
                    </button>

                    {isExpanded && (
                      <div className="dept-records-list">
                        {h.records.map((rec, i) => (
                          <div className="dept-record-item" key={i}>
                            <div>
                              <span className="dept-record-tag">{rec.referenceNumber}</span>
                              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                {formatDate(rec.date)} · Auth by {rec.authorizedBy}
                              </div>
                              {rec.purpose && (
                                <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic' }}>
                                  &ldquo;{rec.purpose}&rdquo;
                                </div>
                              )}
                            </div>
                            <div style={{ fontWeight: 700, color: '#047857' }}>
                              +{rec.quantity} {h.unit}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── View 2: Timeline Table ────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="dept-table-wrap">
          {loading ? (
            <div className="dept-empty">Loading dispatch ledger…</div>
          ) : timeline.length === 0 ? (
            <div className="dept-empty">No dispatch records found.</div>
          ) : (
            <table className="dept-table">
              <thead>
                <tr>
                  <th>Voucher / Ref</th>
                  <th>Date</th>
                  <th>Item Dispatched</th>
                  <th>Department</th>
                  <th>Quantity</th>
                  <th>Authorized By</th>
                  <th>Purpose &amp; Notes</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`dept-table-tag ${item.type === 'DEMAND_FULFILLED' ? 'demand' : 'issue'}`}>
                        {item.referenceNumber}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.date)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.itemName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                        {item.itemCode} · <span className={`dept-badge ${item.category === 'CAPEX' ? 'capex' : 'opex'}`}>{item.category}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.deptName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.deptCode}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#047857', fontSize: 14 }}>
                        {item.quantity}
                      </span>{' '}
                      <span style={{ fontSize: 11, color: '#64748b' }}>{item.unit}</span>
                    </td>
                    <td>{item.authorizedBy}</td>
                    <td>
                      <div>{item.purpose || '—'}</div>
                      {item.notes && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {item.notes}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Direct Issue Modal ────────────────────────────────── */}
      {showIssueModal && (
        <div className="dept-modal-backdrop" onClick={() => setShowIssueModal(false)}>
          <div className="dept-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dept-modal-head">
              <div className="dept-modal-title">Internal Issue to Department</div>
              <button className="dept-modal-close" onClick={() => setShowIssueModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleDirectIssue}>
              <div className="dept-modal-body">
                {modalError && <div className="dept-alert-error">{modalError}</div>}

                <div className="dept-form-group">
                  <label className="dept-form-label">Target Department</label>
                  {isDeptLocked ? (
                    <input
                      type="text"
                      className="dept-form-input"
                      value={`${user.deptName} (${user.deptCode})`}
                      disabled
                    />
                  ) : (
                    <select
                      className="dept-form-select"
                      value={modalDeptId}
                      onChange={(e) => setModalDeptId(e.target.value)}
                      required
                    >
                      {departments.map((d) => (
                        <option key={d.deptId} value={String(d.deptId)}>
                          {d.deptName} ({d.deptCode})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Item Code</label>
                  <input
                    type="text"
                    className="dept-form-input"
                    placeholder="e.g. ITEM-C-001 (X-Ray Machine) or ITEM-O-001"
                    value={modalItemCode}
                    onChange={(e) => setModalItemCode(e.target.value)}
                    required
                  />
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Quantity to Issue</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    className="dept-form-input"
                    placeholder="e.g. 5"
                    value={modalQty}
                    onChange={(e) => setModalQty(e.target.value)}
                    required
                  />
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Purpose / Clinical Requirement</label>
                  <input
                    type="text"
                    className="dept-form-input"
                    placeholder="e.g. Department OPD setup, Clinical replenishment"
                    value={modalPurpose}
                    onChange={(e) => setModalPurpose(e.target.value)}
                  />
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Voucher Notes</label>
                  <textarea
                    className="dept-form-textarea"
                    placeholder="Add any serial numbers, room locations, or hand-over notes…"
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="dept-modal-foot">
                <button
                  type="button"
                  className="dept-btn-cancel"
                  onClick={() => setShowIssueModal(false)}
                  disabled={modalBusy}
                >
                  Cancel
                </button>
                <button type="submit" className="dept-btn-submit" disabled={modalBusy}>
                  {modalBusy ? 'Issuing…' : 'Confirm & Issue Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
