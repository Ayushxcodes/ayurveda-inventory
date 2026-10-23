"use client";

import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';
import { fetchWithCache } from '../lib/client-cache';
import Sidebar from '../components/Sidebar';

const OpexDashboard = dynamic(() => import('../components/OpexDashboard'), { ssr: false });
const CapexDashboard = dynamic(() => import('../components/CapexDashboard'), { ssr: false });
const AllItemsDashboard = dynamic(() => import('../components/AllItemsDashboard'), { ssr: false });
const RegistryDashboard = dynamic(() => import('../components/RegistryDashboard'), { ssr: false });
const AyurVaidyaGRN = dynamic(() => import('../components/AyurVaidyaGRN'), { ssr: false });
const AyurVaidyaStockIssue = dynamic(() => import('../components/AyurVaidyaStockIssue'), { ssr: false });

export default function Home() {
  const [activeTab, setActiveTab] = useState<'ALL'|'CAPEX'|'OPEX'|'REG'|'GRN'|'ISS'>('ALL');
  const [grnView, setGrnView] = useState<'grn'|'qr'>('grn');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [today, setToday] = useState(() => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));

  const breadcrumbLabel = activeTab === 'GRN'
    ? 'Stock Inward (GRN)'
    : activeTab === 'ISS'
    ? 'Stock Issue'
    : activeTab === 'OPEX'
    ? 'OPEX stock'
    : activeTab === 'CAPEX'
    ? 'CAPEX assets'
    : 'All items';

  useEffect(() => {
    // Gentle idle prefetch of secondary tabs so navigation is instant
    const timer = setTimeout(() => {
      fetchWithCache('/api/capex').catch(() => {});
      fetchWithCache('/api/opex').catch(() => {});
      fetchWithCache('/api/registry').catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setToday(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Listen for requests coming from other UI (DetailPanel) to open Issue / GRN flows
  useEffect(() => {
    function onOpenIssue(e: Event) {
      try {
        const customEv = e as CustomEvent<string | number | undefined>;
        const id = customEv?.detail ?? null;
        if (id) sessionStorage.setItem('openItemForISS', String(id));
        setActiveTab('ISS');
      } catch {}
    }
    function onOpenGrn(e: Event) {
      try {
        const customEv = e as CustomEvent<string | number | undefined>;
        const id = customEv?.detail ?? null;
        if (id) sessionStorage.setItem('openItemForGRN', String(id));
        setActiveTab('GRN');
        setGrnView('grn');
      } catch {}
    }
    function onOpenRegistry() {
      try {
        // When opening registry from elsewhere, ensure the registry tab is shown.
        setActiveTab('REG');
      } catch {}
    }
    window.addEventListener('open-issue', onOpenIssue);
    window.addEventListener('open-grn', onOpenGrn);
    window.addEventListener('open-registry', onOpenRegistry);
    return () => {
      window.removeEventListener('open-issue', onOpenIssue);
      window.removeEventListener('open-grn', onOpenGrn);
      window.removeEventListener('open-registry', onOpenRegistry);
    }
  }, []);

  return (
    <div className="app-root" style={{ display: "flex", width: "100%", height: "100vh" }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        grnView={grnView}
        setGrnView={setGrnView}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
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
            <div className="page-title">{activeTab === 'REG' ? 'Item Registry' : activeTab === 'GRN' ? 'Stock Inward' : activeTab === 'ISS' ? 'Stock Issue' : 'Dashboard'}</div>
            <div className="breadcrumb">/ <span>{breadcrumbLabel}</span></div>
          </div>
          <div className="topbar-right">
            <div className="status-pill"><div className="status-dot"></div> System online</div>
            <div className="date-chip">{today}</div>
          </div>
        </header>

        {activeTab !== 'GRN' && activeTab !== 'REG' && (
          <div className="tab-bar">
            {activeTab === 'ISS' ? (
              <div className={`tab active`} style={{ flex: 1, textAlign: 'center' }}>Stock Issue</div>
            ) : (
              <>
                <div className={`tab ${activeTab==='ALL'?'active':''}`} onClick={()=>setActiveTab('ALL')}>All items</div>
                <div className={`tab ${activeTab==='CAPEX'?'active':''}`} onClick={()=>setActiveTab('CAPEX')}>CAPEX only</div>
                <div className={`tab ${activeTab==='OPEX'?'active':''}`} onClick={()=>setActiveTab('OPEX')}>OPEX only</div>
              </>
            )}
          </div>
        )}

        <div className="content">
          {activeTab === 'ISS' ? (
            <AyurVaidyaStockIssue />
          ) : activeTab === 'GRN' ? (
            <AyurVaidyaGRN grnView={grnView} />
          ) : activeTab === 'REG' ? (
            <RegistryDashboard />
          ) : activeTab === 'ALL' ? (
            <AllItemsDashboard />
          ) : activeTab === 'OPEX' ? (
            <OpexDashboard />
          ) : (
            <CapexDashboard />
          )}
        </div>
      </div>
    </div>
  );
}
