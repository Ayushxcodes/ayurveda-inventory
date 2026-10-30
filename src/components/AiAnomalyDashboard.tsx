'use client';

import React, { useState, useEffect } from 'react';
import type { SessionUser } from '@/lib/auth/roles';
import './ai-anomaly/anomaly.css';

interface Department {
  deptId: number;
  deptCode: string;
  deptName: string;
}

interface DispatchEvent {
  referenceNumber: string;
  date: string;
  quantity: number;
  authorizedBy: string;
}

interface AnomalyItem {
  id: string
  alertId?: number
  type: 'PREMATURE_REDISPATCH' | 'RAPID_CAPEX_REISSUE' | 'CONSUMPTION_SPIKE' | 'VELOCITY_SURGE'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  itemCode: string
  itemName: string
  category: 'CAPEX' | 'OPEX'
  unit: string
  departmentId: number
  departmentName: string
  departmentCode: string
  firstDispatch: DispatchEvent
  secondDispatch: DispatchEvent
  elapsedDays: number
  expectedDurationDays: number
  prematureDays: number
  standardDailyRate: string
  confidenceScore: number
  anomalyScorePercent: number
  aiAnalysis: string
  recommendedAction: string
  status: 'active' | 'acknowledged' | 'investigating' | 'resolved'
  detectedAt: string
}

interface AnomalySummary {
  totalAnomalies: number
  criticalCount: number
  highCount: number
  prematureDispatchesCount: number
  affectedDepartmentsCount: number
}

export default function AiAnomalyDashboard({ user }: { user: SessionUser }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    user.deptId ? String(user.deptId) : 'all'
  );
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PREMATURE_REDISPATCH' | 'RAPID_CAPEX_REISSUE'>('ALL');
  const [search, setSearch] = useState('');
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [summary, setSummary] = useState<AnomalySummary>({
    totalAnomalies: 0,
    criticalCount: 0,
    highCount: 0,
    prematureDispatchesCount: 0,
    affectedDepartmentsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const isDeptLocked = user.role === 'hod' && Boolean(user.deptId);

  useEffect(() => {
    let cancelled = false;
    const fetchAnomalies = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedDeptId !== 'all') params.set('deptId', selectedDeptId);
        if (severityFilter !== 'ALL') params.set('severity', severityFilter);
        if (typeFilter !== 'ALL') params.set('type', typeFilter);
        if (search.trim()) params.set('q', search.trim());

        const res = await fetch(`/api/anomalies?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setDepartments(data.departments || []);
        setAnomalies(data.anomalies || []);
        if (data.summary) setSummary(data.summary);
      } catch (err: unknown) {
        console.error('Failed to load anomalies:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAnomalies();
    return () => {
      cancelled = true;
    };
  }, [selectedDeptId, severityFilter, typeFilter, search, refreshKey]);

  const handleUpdateStatus = async (id: string, nextStatus: 'acknowledged' | 'investigating' | 'resolved') => {
    try {
      const res = await fetch(`/api/anomalies/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setNotice(`Anomaly marked as ${nextStatus}. Logged by ${user.fullName}.`);
        setAnomalies((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: nextStatus } : a))
        );
        setTimeout(() => setNotice(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
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
    <div className="anom-page">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="anom-header">
        <div className="anom-title-group">
          <div className="anom-title-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2l2.4 5.6L20 10l-4.4 4 1.4 6-5-3.2-5 3.2 1.4-6L4 10l5.6-2.4L12 2z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="anom-title">
              AI Anomaly Detection &amp; ML Insights
              <span className="anom-ai-badge">Velocity Engine v2.4</span>
            </div>
            <div className="anom-subtitle">
              Machine learning surveillance detecting premature re-dispatches, abnormal consumption velocity, and duplicate hospital equipment issues
            </div>
          </div>
        </div>

        <div className="anom-engine-status">
          <span className="anom-pulse-dot" />
          <span>Real-time ML Heuristics Active</span>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, color: '#047857', fontSize: 13, marginBottom: 16 }}>
          ✓ {notice}
        </div>
      )}

      {/* ── KPI Stat Strip ────────────────────────────────────── */}
      <div className="anom-kpi-grid">
        <div className="anom-kpi-card kpi-crit">
          <div className="anom-kpi-label">Critical Anomalies</div>
          <div className="anom-kpi-val" style={{ color: '#dc2626' }}>{summary.criticalCount}</div>
          <div className="anom-kpi-sub">Immediate hospital audit required</div>
        </div>

        <div className="anom-kpi-card kpi-premature">
          <div className="anom-kpi-label">Premature Re-Dispatches</div>
          <div className="anom-kpi-val" style={{ color: '#d97706' }}>{summary.prematureDispatchesCount}</div>
          <div className="anom-kpi-sub">Issued before expected depletion date</div>
        </div>

        <div className="anom-kpi-card kpi-total">
          <div className="anom-kpi-label">Total Flagged Incidents</div>
          <div className="anom-kpi-val" style={{ color: '#9333ea' }}>{summary.totalAnomalies}</div>
          <div className="anom-kpi-sub">Surveillance across all items &amp; machinery</div>
        </div>

        <div className="anom-kpi-card kpi-depts">
          <div className="anom-kpi-label">Departments Under Watch</div>
          <div className="anom-kpi-val" style={{ color: '#059669' }}>{summary.affectedDepartmentsCount}</div>
          <div className="anom-kpi-sub">With active consumption anomalies</div>
        </div>
      </div>

      {/* ── Filter Toolbar ─────────────────────────────────────── */}
      <div className="anom-toolbar">
        <div className="anom-toolbar-left">
          {/* Department Selector */}
          <div className="anom-select-wrap">
            <span className="anom-select-label">Department:</span>
            {isDeptLocked ? (
              <span className="anom-dept-pill" style={{ fontSize: 13, padding: '6px 12px' }}>
                🏢 {user.deptName || 'Your Department'}
              </span>
            ) : (
              <select
                className="anom-select"
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

          {/* Severity Chips */}
          <div className="anom-chips">
            <button
              className={`anom-chip ${severityFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('ALL')}
            >
              All Severities
            </button>
            <button
              className={`anom-chip ${severityFilter === 'CRITICAL' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('CRITICAL')}
            >
              Critical Alert
            </button>
            <button
              className={`anom-chip ${severityFilter === 'HIGH' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('HIGH')}
            >
              High Priority
            </button>
          </div>

          {/* Type Filter */}
          <div className="anom-chips">
            <button
              className={`anom-chip ${typeFilter === 'PREMATURE_REDISPATCH' ? 'active' : ''}`}
              onClick={() => setTypeFilter(typeFilter === 'PREMATURE_REDISPATCH' ? 'ALL' : 'PREMATURE_REDISPATCH')}
            >
              🔄 Fast Re-Dispatches
            </button>
            <button
              className={`anom-chip ${typeFilter === 'RAPID_CAPEX_REISSUE' ? 'active' : ''}`}
              onClick={() => setTypeFilter(typeFilter === 'RAPID_CAPEX_REISSUE' ? 'ALL' : 'RAPID_CAPEX_REISSUE')}
            >
              ⚙ Machine Allocations
            </button>
          </div>
        </div>

        {/* Search Input & Refresh */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="anom-search-wrap">
            <span className="anom-search-icon">⌕</span>
            <input
              type="text"
              className="anom-search-input"
              placeholder="Search anomaly, item, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="anom-chip"
            style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Re-run AI anomaly scan"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Anomaly Cards List ─────────────────────────────────── */}
      {loading ? (
        <div className="anom-empty">
          <div className="anom-empty-icon">🧠</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Running ML heuristic analysis across all hospital dispatches…</div>
        </div>
      ) : anomalies.length === 0 ? (
        <div className="anom-empty">
          <div className="anom-empty-icon">✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>No consumption velocity anomalies detected</div>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            All medical machinery and consumable quantities are being utilized within normal expected operational durations.
          </p>
        </div>
      ) : (
        <div className="anom-list">
          {anomalies.map((anom) => {
            const isCrit = anom.severity === 'CRITICAL';
            return (
              <div key={anom.id} className={`anom-card ${isCrit ? 'crit' : 'high'}`}>
                {/* Header Row */}
                <div className="anom-card-header">
                  <div className="anom-item-title-wrap">
                    <span className="anom-item-name">{anom.itemName}</span>
                    <span className="anom-item-code">{anom.itemCode}</span>
                    <span className={`anom-category-pill ${anom.category === 'CAPEX' ? 'capex' : 'opex'}`}>
                      {anom.category}
                    </span>
                    <span className="anom-dept-pill">
                      🏢 {anom.departmentName} ({anom.departmentCode})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`anom-sev-badge ${isCrit ? 'crit' : 'high'}`}>
                      <span>⚠</span> {anom.severity} ANOMALY
                    </span>
                    {anom.status !== 'active' && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#e2e8f0', color: '#475569', textTransform: 'uppercase' }}>
                        {anom.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Timeline Comparison & Duration Metrics */}
                <div className="anom-timeline-comparison">
                  {/* Event 1 */}
                  <div className="anom-event-box">
                    <div className="anom-event-tag">Initial Dispatch (D1)</div>
                    <div className="anom-event-qty">
                      {anom.firstDispatch.quantity} <span style={{ fontSize: 13, color: '#64748b' }}>{anom.unit}</span>
                    </div>
                    <div className="anom-event-meta">
                      📅 {formatDate(anom.firstDispatch.date)}
                    </div>
                    <div className="anom-event-meta" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      Ref: {anom.firstDispatch.referenceNumber}
                    </div>
                  </div>

                  {/* Arrow & Elapsed Days */}
                  <div className="anom-arrow-connector">
                    <span>➔</span>
                    <span className="anom-arrow-label">
                      {anom.elapsedDays} day{anom.elapsedDays === 1 ? '' : 's'} later
                    </span>
                  </div>

                  {/* Event 2 (The Repeat Dispatch) */}
                  <div className="anom-event-box">
                    <div className="anom-event-tag" style={{ color: '#dc2626' }}>
                      Repeat Dispatch (D2)
                    </div>
                    <div className="anom-event-qty" style={{ color: '#dc2626' }}>
                      +{anom.secondDispatch.quantity} <span style={{ fontSize: 13, color: '#64748b' }}>{anom.unit}</span>
                    </div>
                    <div className="anom-event-meta">
                      📅 {formatDate(anom.secondDispatch.date)}
                    </div>
                    <div className="anom-event-meta" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      Ref: {anom.secondDispatch.referenceNumber}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, height: '80%', background: '#cbd5e1' }} />

                  {/* Velocity Gap Breakdown */}
                  <div className="anom-gap-metrics">
                    <div className="anom-metric-row">
                      <span className="anom-metric-lbl">Standard Run Rate:</span>
                      <span className="anom-metric-val">{anom.standardDailyRate}</span>
                    </div>
                    <div className="anom-metric-row">
                      <span className="anom-metric-lbl">Expected Duration:</span>
                      <span className="anom-metric-val">~{anom.expectedDurationDays} days</span>
                    </div>
                    <div className="anom-metric-row">
                      <span className="anom-metric-lbl">Actual Elapsed Time:</span>
                      <span className="anom-metric-val">{anom.elapsedDays} days</span>
                    </div>
                    <div className="anom-metric-row">
                      <span className="anom-metric-lbl">Premature Re-Issue By:</span>
                      <span className="anom-metric-val premature">
                        -{anom.prematureDays} days early
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Forensic Diagnosis */}
                <div className="anom-analysis-box">
                  <div className="anom-brain-icon">🧠</div>
                  <div className="anom-analysis-content">
                    <div className="anom-analysis-heading">
                      <span>AI Forensic Analysis &amp; Diagnostic Finding</span>
                      <span className="anom-confidence-badge">{anom.confidenceScore}% Confidence</span>
                      <span style={{ fontSize: 11, color: '#9333ea', fontWeight: 600 }}>
                        Velocity Deviation: {anom.anomalyScorePercent}%
                      </span>
                    </div>
                    <div className="anom-analysis-text">
                      {anom.aiAnalysis}
                    </div>
                    <div className="anom-rec-box">
                      <strong>💡 Recommended Operational Action:</strong> {anom.recommendedAction}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="anom-card-actions">
                  <div className="anom-detected-time">
                    Surveillance Triggered: {formatDate(anom.detectedAt)} · Anomaly ID: <code style={{ fontFamily: 'monospace' }}>{anom.id}</code>
                  </div>

                  <div className="anom-action-btns">
                    {anom.status === 'active' && (
                      <>
                        <button
                          className="anom-btn anom-btn-ack"
                          onClick={() => handleUpdateStatus(anom.id, 'acknowledged')}
                        >
                          ✓ Acknowledge
                        </button>
                        <button
                          className="anom-btn anom-btn-flag"
                          onClick={() => handleUpdateStatus(anom.id, 'investigating')}
                        >
                          🚩 Flag for HOD Investigation
                        </button>
                      </>
                    )}
                    {anom.status === 'acknowledged' && (
                      <button
                        className="anom-btn anom-btn-flag"
                        onClick={() => handleUpdateStatus(anom.id, 'investigating')}
                      >
                        🚩 Open Investigation
                      </button>
                    )}
                    {anom.status === 'investigating' && (
                      <button
                        className="anom-btn anom-btn-ack"
                        onClick={() => handleUpdateStatus(anom.id, 'resolved')}
                      >
                        ✓ Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
