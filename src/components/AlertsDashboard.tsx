'use client';

import React, { useState, useEffect } from 'react';
import type { SessionUser } from '@/lib/auth/roles';
import { canSendAlerts, ROLE_LABELS } from '@/lib/auth/roles';
import './alerts/alerts.css';

interface TargetDept {
  deptId: number;
  deptCode: string;
  deptName: string;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  targetRole: string;
  targetDeptId: number | null;
  targetDept?: TargetDept | null;
  createdBy: number;
  senderRole: string;
  senderName: string;
  createdAt: string;
  isPinned: boolean;
  status: string;
}

interface SystemAlertItem {
  alertId: number;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  daysRemaining: number | null;
  thresholdValue: number | null;
  status: string;
  triggeredAt: string;
  item: {
    itemId: number;
    itemCode: string;
    itemName: string;
    category: string;
    unit: string;
    primaryDept?: {
      deptCode: string;
      deptName: string;
    } | null;
  };
  batch?: {
    batchId: number;
    batchNumber: string;
    expiryDate: string | null;
    quantityAvailable: number;
  } | null;
}

interface Props {
  user: SessionUser;
}

export default function AlertsDashboard({ user }: Props) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlertItem[]>([]);
  const [departments, setDepartments] = useState<TargetDept[]>([]);
  const [summary, setSummary] = useState({
    totalRoleNotifications: 0,
    criticalCount: 0,
    myRoleCount: 0,
    systemAlertsCount: 0,
    canSend: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Broadcast modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalMessage, setModalMessage] = useState<string>('');
  const [modalSeverity, setModalSeverity] = useState<string>('high');
  const [modalTargetRole, setModalTargetRole] = useState<string>('all');
  const [modalTargetDeptId, setModalTargetDeptId] = useState<string>('all');
  const [modalIsPinned, setModalIsPinned] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');

  const canBroadcast = canSendAlerts(user.role);

  useEffect(() => {
    let cancelled = false;

    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeTab !== 'all') params.set('tab', activeTab);
        if (severityFilter !== 'all') params.set('severity', severityFilter);
        if (search.trim()) params.set('q', search.trim());

        const res = await fetch(`/api/alerts?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setNotifications(data.notifications || []);
        setSystemAlerts(data.systemAlerts || []);
        setDepartments(data.departments || []);
        if (data.summary) setSummary(data.summary);
      } catch (err) {
        console.error('Failed to load alerts:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAlerts();
    return () => {
      cancelled = true;
    };
  }, [activeTab, severityFilter, search, refreshKey]);

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      setModalError('Please enter an alert title.');
      return;
    }
    if (!modalMessage.trim()) {
      setModalError('Please enter alert instructions or message.');
      return;
    }

    setSubmitting(true);
    setModalError('');
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          title: modalTitle.trim(),
          message: modalMessage.trim(),
          severity: modalSeverity,
          targetRole: modalTargetRole,
          targetDeptId: user.role === 'hod' ? user.deptId : modalTargetDeptId,
          isPinned: modalIsPinned,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to broadcast alert.');
        setSubmitting(false);
        return;
      }

      setNotice(`Alert broadcasted successfully to ${modalTargetRole === 'all' ? 'All Roles' : modalTargetRole.toUpperCase()}!`);
      setIsModalOpen(false);
      setModalTitle('');
      setModalMessage('');
      setModalSeverity('high');
      setModalTargetRole('all');
      setModalIsPinned(false);
      setRefreshKey((k) => k + 1);
      setTimeout(() => setNotice(''), 4500);
    } catch {
      setModalError('An unexpected network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotification = async (id: number) => {
    if (!confirm('Are you sure you want to delete this alert notification?')) return;
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotice('Alert notification deleted.');
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setTimeout(() => setNotice(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePin = async (id: number, currentPinned: boolean) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isPinned: !currentPinned } : n))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getRoleTargetLabel = (role: string) => {
    if (role === 'all') return 'All Staff & Roles';
    if (role === 'hod') return 'Head of Departments (HOD)';
    if (role === 'requester') return 'Clinical & Requester Staff';
    if (role === 'procurement_officer') return 'Procurement Team';
    if (role === 'admin') return 'Inventory Administrators';
    return role;
  };

  return (
    <div className="alerts-page">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="alerts-header">
        <div className="alerts-title-group">
          <div className="alerts-title-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 01-3.46 0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="alerts-title">
              Alerts &amp; Role Notifications Center
              <span className="alerts-badge">Live Broadcast Engine</span>
            </div>
            <div className="alerts-subtitle">
              Role-targeted operational alerts, clinical emergency notices, hospital directives, and real-time inventory threshold surveillance
            </div>
          </div>
        </div>

        <div className="alerts-header-actions">
          {canBroadcast && (
            <button
              type="button"
              className="btn-send-alert"
              onClick={() => setIsModalOpen(true)}
            >
              <span>📢</span> Broadcast New Alert
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div style={{ padding: '10px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, color: '#047857', fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>
          ✓ {notice}
        </div>
      )}

      {/* ── KPI Stat Strip ────────────────────────────────────────── */}
      <div className="alerts-kpi-grid">
        <div className="alerts-kpi-card kpi-crit">
          <div className="alerts-kpi-label">Critical Notifications</div>
          <div className="alerts-kpi-val" style={{ color: '#dc2626' }}>{summary.criticalCount}</div>
          <div className="alerts-kpi-sub">Requiring immediate protocol action</div>
        </div>

        <div className="alerts-kpi-card kpi-role">
          <div className="alerts-kpi-label">Targeted To My Role</div>
          <div className="alerts-kpi-val" style={{ color: '#2563eb' }}>{summary.myRoleCount}</div>
          <div className="alerts-kpi-sub">Active alerts for {ROLE_LABELS[user.role]}</div>
        </div>

        <div className="alerts-kpi-card kpi-total">
          <div className="alerts-kpi-label">Total Active Bulletins</div>
          <div className="alerts-kpi-val" style={{ color: '#7c3aed' }}>{summary.totalRoleNotifications}</div>
          <div className="alerts-kpi-sub">Broadcasted by Hospital Admins &amp; HODs</div>
        </div>

        <div className="alerts-kpi-card kpi-sys">
          <div className="alerts-kpi-label">Inventory Threshold Alerts</div>
          <div className="alerts-kpi-val" style={{ color: '#ea580c' }}>{summary.systemAlertsCount}</div>
          <div className="alerts-kpi-sub">Low stock, expiry, and AMC alerts</div>
        </div>
      </div>

      {/* ── Role Filter Navigation Tabs ───────────────────────────── */}
      <div className="alerts-role-tabs-wrap">
        <button
          type="button"
          className={`alerts-role-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span>📋</span> All Alerts
          <span className="alerts-tab-badge">{summary.totalRoleNotifications}</span>
        </button>

        <button
          type="button"
          className={`alerts-role-tab ${activeTab === 'my_role' ? 'active' : ''}`}
          onClick={() => setActiveTab('my_role')}
        >
          <span>👤</span> For My Role ({ROLE_LABELS[user.role]})
          <span className="alerts-tab-badge">{summary.myRoleCount}</span>
        </button>

        <button
          type="button"
          className={`alerts-role-tab ${activeTab === 'broadcasts' ? 'active' : ''}`}
          onClick={() => setActiveTab('broadcasts')}
        >
          <span>📢</span> Hospital Broadcasts
        </button>

        <button
          type="button"
          className={`alerts-role-tab ${activeTab === 'hod' ? 'active' : ''}`}
          onClick={() => setActiveTab('hod')}
        >
          <span>🏢</span> HOD Directives
        </button>

        <button
          type="button"
          className={`alerts-role-tab ${activeTab === 'requester' ? 'active' : ''}`}
          onClick={() => setActiveTab('requester')}
        >
          <span>🩺</span> Clinical / Requesters
        </button>

        <button
          type="button"
          className={`alerts-role-tab ${activeTab === 'procurement' ? 'active' : ''}`}
          onClick={() => setActiveTab('procurement')}
        >
          <span>📦</span> Procurement
        </button>

        {canBroadcast && (
          <button
            type="button"
            className={`alerts-role-tab ${activeTab === 'sent_by_me' ? 'active' : ''}`}
            onClick={() => setActiveTab('sent_by_me')}
          >
            <span>✍</span> Sent By Me
          </button>
        )}

        <button
          type="button"
          className={`alerts-role-tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <span>⚙</span> System Inventory Alerts
          <span className="alerts-tab-badge">{summary.systemAlertsCount}</span>
        </button>
      </div>

      {/* ── Toolbar: Search & Severity Filter ─────────────────────── */}
      <div className="alerts-toolbar">
        <div className="alerts-toolbar-left">
          <div className="alerts-search-box">
            <span className="alerts-search-icon">⌕</span>
            <input
              type="text"
              className="alerts-search-input"
              placeholder="Search title, sender, department, keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="alerts-filter-chips">
            <button
              type="button"
              className={`alerts-chip ${severityFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('all')}
            >
              All Severities
            </button>
            <button
              type="button"
              className={`alerts-chip ${severityFilter === 'critical' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('critical')}
            >
              🔴 Critical
            </button>
            <button
              type="button"
              className={`alerts-chip ${severityFilter === 'high' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('high')}
            >
              🟠 High
            </button>
            <button
              type="button"
              className={`alerts-chip ${severityFilter === 'medium' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('medium')}
            >
              🟡 Medium
            </button>
            <button
              type="button"
              className={`alerts-chip ${severityFilter === 'info' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('info')}
            >
              🔵 Info
            </button>
          </div>
        </div>

        <button
          type="button"
          className="alerts-chip"
          style={{ cursor: 'pointer' }}
          onClick={() => setRefreshKey((k) => k + 1)}
          title="Refresh alerts"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Main Content Area ─────────────────────────────────────── */}
      {loading ? (
        <div className="alerts-empty">
          <div className="alerts-empty-icon">⏳</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Synchronizing alerts and role notifications…</div>
        </div>
      ) : activeTab === 'system' ? (
        /* System Inventory Alerts Table */
        <div className="sys-alerts-table-wrap">
          {systemAlerts.length === 0 ? (
            <div className="alerts-empty">
              <div className="alerts-empty-icon">✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>No active inventory threshold alerts</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>All stocks are above minimum threshold levels and no batches are expiring.</p>
            </div>
          ) : (
            <table className="sys-alerts-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Item / Code</th>
                  <th>Department</th>
                  <th>Batch / Expiry</th>
                  <th>Triggered Notice</th>
                  <th>Logged Date</th>
                </tr>
              </thead>
              <tbody>
                {systemAlerts.map((sa) => (
                  <tr key={sa.alertId}>
                    <td>
                      <span className={`severity-pill ${sa.severity}`}>
                        {sa.severity}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: 12, textTransform: 'uppercase' }}>
                        {sa.alertType.replace(/_/g, ' ')}
                      </strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{sa.item.itemName}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{sa.item.itemCode} · {sa.item.category}</div>
                    </td>
                    <td>
                      {sa.item.primaryDept?.deptName || 'Hospital Wide'}
                    </td>
                    <td>
                      {sa.batch ? (
                        <div>
                          <div>Batch: {sa.batch.batchNumber}</div>
                          {sa.batch.expiryDate && (
                            <div style={{ fontSize: 11, color: '#dc2626' }}>
                              Exp: {new Date(sa.batch.expiryDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{sa.title}</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{sa.message}</div>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {formatTimestamp(sa.triggeredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Role Notifications List */
        notifications.length === 0 ? (
          <div className="alerts-empty">
            <div className="alerts-empty-icon">✓</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>No active notifications for this filter</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              There are currently no broadcasted bulletins or alerts matching the selected role criteria.
            </p>
          </div>
        ) : (
          <div className="alerts-list">
            {notifications.map((notif) => {
              const isAuthor = notif.createdBy === user.userId;
              const isAdmin = user.role === 'admin' || user.role === 'super_admin';

              return (
                <div
                  key={notif.id}
                  className={`notif-card ${notif.severity} ${notif.isPinned ? 'pinned' : ''}`}
                >
                  <div className="notif-top-bar">
                    <div className="notif-badges-group">
                      <span className={`severity-pill ${notif.severity}`}>
                        {notif.severity}
                      </span>

                      {notif.isPinned && (
                        <span className="pinned-pill">
                          📌 Pinned
                        </span>
                      )}

                      <span className="target-role-pill">
                        Audience: {getRoleTargetLabel(notif.targetRole)}
                      </span>

                      {notif.targetDept && (
                        <span className="target-dept-pill">
                          🏢 {notif.targetDept.deptName} ({notif.targetDept.deptCode})
                        </span>
                      )}
                    </div>

                    <div className="notif-author-meta">
                      <span>{formatTimestamp(notif.createdAt)}</span>
                    </div>
                  </div>

                  <div className="notif-title">{notif.title}</div>
                  <div className="notif-message">{notif.message}</div>

                  <div className="notif-footer">
                    <div className="notif-sender-info">
                      <div className="sender-avatar">
                        {notif.senderName ? notif.senderName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <strong>{notif.senderName}</strong>
                        <span style={{ margin: '0 4px', color: '#cbd5e1' }}>•</span>
                        <span className="sender-role-tag">
                          {ROLE_LABELS[notif.senderRole as keyof typeof ROLE_LABELS] || notif.senderRole}
                        </span>
                      </div>
                    </div>

                    <div className="notif-actions">
                      {canBroadcast && (
                        <button
                          type="button"
                          className="btn-notif-action"
                          onClick={() => handleTogglePin(notif.id, notif.isPinned)}
                        >
                          {notif.isPinned ? 'Unpin' : 'Pin to Top'}
                        </button>
                      )}

                      {(isAuthor || isAdmin) && (
                        <button
                          type="button"
                          className="btn-notif-action delete"
                          onClick={() => handleDeleteNotification(notif.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Modal for Broadcasting New Alert ──────────────────────── */}
      {isModalOpen && (
        <div className="alerts-modal-overlay">
          <div className="alerts-modal">
            <div className="alerts-modal-header">
              <div className="alerts-modal-title">
                <span>📢</span> Broadcast Alert / Notification
              </div>
              <button
                type="button"
                className="alerts-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBroadcastSubmit}>
              <div className="alerts-modal-body">
                {modalError && (
                  <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 8, fontSize: 13 }}>
                    {modalError}
                  </div>
                )}

                <div className="alerts-form-group">
                  <label className="alerts-form-label">Alert Headline / Title *</label>
                  <input
                    type="text"
                    className="alerts-form-input"
                    placeholder="e.g. Urgent Ward Stock Verification / AMC Machinery Inspection"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="alerts-form-row">
                  <div className="alerts-form-group">
                    <label className="alerts-form-label">Severity Level</label>
                    <select
                      className="alerts-form-select"
                      value={modalSeverity}
                      onChange={(e) => setModalSeverity(e.target.value)}
                    >
                      <option value="critical">🔴 Critical (Immediate Alert)</option>
                      <option value="high">🟠 High Priority</option>
                      <option value="medium">🟡 Medium Priority</option>
                      <option value="info">🔵 Informational Notice</option>
                    </select>
                  </div>

                  <div className="alerts-form-group">
                    <label className="alerts-form-label">Target Audience (Role)</label>
                    <select
                      className="alerts-form-select"
                      value={modalTargetRole}
                      onChange={(e) => setModalTargetRole(e.target.value)}
                    >
                      <option value="all">📢 All Staff &amp; Roles</option>
                      <option value="hod">🏢 Head of Departments (HOD)</option>
                      <option value="requester">🩺 Clinical &amp; Ward Requesters</option>
                      <option value="procurement_officer">📦 Procurement Officers</option>
                      <option value="admin">🔒 Inventory Administrators</option>
                    </select>
                  </div>
                </div>

                <div className="alerts-form-group">
                  <label className="alerts-form-label">Target Department</label>
                  {user.role === 'hod' ? (
                    <div style={{ fontSize: 13, color: '#475569', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      🏢 Scoped to your department: <strong>{user.deptName || 'Current Department'}</strong>
                    </div>
                  ) : (
                    <select
                      className="alerts-form-select"
                      value={modalTargetDeptId}
                      onChange={(e) => setModalTargetDeptId(e.target.value)}
                    >
                      <option value="all">🏢 All Hospital Departments</option>
                      {departments.map((d) => (
                        <option key={d.deptId} value={d.deptId}>
                          {d.deptName} ({d.deptCode})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="alerts-form-group">
                  <label className="alerts-form-label">Alert Message &amp; Instructions *</label>
                  <textarea
                    className="alerts-form-textarea"
                    placeholder="Provide clear operational directives, stock audit guidelines, or discrepancy warnings…"
                    value={modalMessage}
                    onChange={(e) => setModalMessage(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="pinAlert"
                    checked={modalIsPinned}
                    onChange={(e) => setModalIsPinned(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="pinAlert" style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    Pin this alert to the top of all role dashboards
                  </label>
                </div>
              </div>

              <div className="alerts-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={submitting}
                >
                  {submitting ? 'Broadcasting…' : 'Publish Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
