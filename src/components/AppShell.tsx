'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchWithCache } from '@/lib/client-cache';
import Sidebar from './Sidebar';
import {
  ROLE_LABELS,
  canAccessTab,
  userInitials,
  type AppTab,
  type SessionUser,
} from '@/lib/auth/roles';

const OpexDashboard = dynamic(() => import('./OpexDashboard'), { ssr: false });
const CapexDashboard = dynamic(() => import('./CapexDashboard'), { ssr: false });
const AllItemsDashboard = dynamic(() => import('./AllItemsDashboard'), { ssr: false });
const RegistryDashboard = dynamic(() => import('./RegistryDashboard'), { ssr: false });
const AyurVaidyaGRN = dynamic(() => import('./AyurVaidyaGRN'), { ssr: false });
const AyurVaidyaStockIssue = dynamic(() => import('./AyurVaidyaStockIssue'), { ssr: false });
const UsersDashboard = dynamic(() => import('./UsersDashboard'), { ssr: false });

const PAGE_TITLES: Record<AppTab, string> = {
  ALL: 'Dashboard',
  CAPEX: 'Dashboard',
  OPEX: 'Dashboard',
  REG: 'Item Registry',
  GRN: 'Stock Inward',
  ISS: 'Stock Issue',
  USERS: 'User Management',
};

const BREADCRUMBS: Record<AppTab, string> = {
  ALL: 'All items',
  CAPEX: 'CAPEX assets',
  OPEX: 'OPEX stock',
  REG: 'Item Registry',
  GRN: 'Stock Inward (GRN)',
  ISS: 'Stock Issue',
  USERS: 'User Management',
};

export default function AppShell({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<AppTab>('ALL');
  const [grnView, setGrnView] = useState<'grn' | 'qr'>('grn');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [today, setToday] = useState(() =>
    new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  );

  const navigate = (tab: AppTab) => {
    if (!canAccessTab(user.role, tab)) return;
    setActiveTab(tab);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (canAccessTab(user.role, 'CAPEX')) {
        fetchWithCache('/api/capex').catch(() => {});
      }
      if (canAccessTab(user.role, 'OPEX')) {
        fetchWithCache('/api/opex').catch(() => {});
      }
      if (canAccessTab(user.role, 'REG')) {
        fetchWithCache('/api/registry').catch(() => {});
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [user.role]);

  useEffect(() => {
    const id = setInterval(() => {
      setToday(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onOpenIssue(e: Event) {
      if (!canAccessTab(user.role, 'ISS')) return;
      try {
        const customEv = e as CustomEvent<string | number | undefined>;
        const id = customEv?.detail ?? null;
        if (id) sessionStorage.setItem('openItemForISS', String(id));
        setActiveTab('ISS');
      } catch {}
    }
    function onOpenGrn(e: Event) {
      if (!canAccessTab(user.role, 'GRN')) return;
      try {
        const customEv = e as CustomEvent<string | number | undefined>;
        const id = customEv?.detail ?? null;
        if (id) sessionStorage.setItem('openItemForGRN', String(id));
        setActiveTab('GRN');
        setGrnView('grn');
      } catch {}
    }
    function onOpenRegistry() {
      if (!canAccessTab(user.role, 'REG')) return;
      setActiveTab('REG');
    }
    function onOpenUsers() {
      if (!canAccessTab(user.role, 'USERS')) return;
      setActiveTab('USERS');
    }
    window.addEventListener('open-issue', onOpenIssue);
    window.addEventListener('open-grn', onOpenGrn);
    window.addEventListener('open-registry', onOpenRegistry);
    window.addEventListener('open-users', onOpenUsers);
    return () => {
      window.removeEventListener('open-issue', onOpenIssue);
      window.removeEventListener('open-grn', onOpenGrn);
      window.removeEventListener('open-registry', onOpenRegistry);
      window.removeEventListener('open-users', onOpenUsers);
    };
  }, [user.role]);

  return (
    <div className="app-root" style={{ display: 'flex', width: '100%', height: '100vh' }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={navigate}
        grnView={grnView}
        setGrnView={setGrnView}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        user={user}
      />

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="sidebar-mobile-toggle"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="page-title">{PAGE_TITLES[activeTab]}</div>
            <div className="breadcrumb">
              / <span>{BREADCRUMBS[activeTab]}</span>
            </div>
          </div>
          <div className="topbar-right">
            <div className="status-pill">
              <div className="status-dot"></div> System online
            </div>
            <div className="date-chip">{today}</div>
            <div className="topbar-user" title={`${user.fullName} · ${ROLE_LABELS[user.role]}`}>
              <div className="topbar-avatar">{userInitials(user.fullName)}</div>
              <div className="topbar-user-meta">
                <div className="topbar-user-name">{user.fullName}</div>
                <div className="topbar-user-role">{ROLE_LABELS[user.role]}</div>
              </div>
            </div>
          </div>
        </header>

        {activeTab !== 'GRN' && activeTab !== 'REG' && activeTab !== 'USERS' && (
          <div className="tab-bar">
            {activeTab === 'ISS' ? (
              <div className={`tab active`} style={{ flex: 1, textAlign: 'center' }}>
                Stock Issue
              </div>
            ) : (
              <>
                <div className={`tab ${activeTab === 'ALL' ? 'active' : ''}`} onClick={() => navigate('ALL')}>
                  All items
                </div>
                {canAccessTab(user.role, 'CAPEX') && (
                  <div className={`tab ${activeTab === 'CAPEX' ? 'active' : ''}`} onClick={() => navigate('CAPEX')}>
                    CAPEX only
                  </div>
                )}
                {canAccessTab(user.role, 'OPEX') && (
                  <div className={`tab ${activeTab === 'OPEX' ? 'active' : ''}`} onClick={() => navigate('OPEX')}>
                    OPEX only
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="content">
          {activeTab === 'ISS' ? (
            <AyurVaidyaStockIssue user={user} />
          ) : activeTab === 'GRN' ? (
            <AyurVaidyaGRN grnView={grnView} user={user} />
          ) : activeTab === 'REG' ? (
            <RegistryDashboard user={user} />
          ) : activeTab === 'ALL' ? (
            <AllItemsDashboard />
          ) : activeTab === 'OPEX' ? (
            <OpexDashboard />
          ) : activeTab === 'CAPEX' ? (
            <CapexDashboard />
          ) : activeTab === 'USERS' ? (
            <UsersDashboard user={user} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
