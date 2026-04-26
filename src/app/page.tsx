"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('../components/charts/BarChart'), { ssr: false });
const OpexDashboard = dynamic(() => import('../components/OpexDashboard'), { ssr: false });

export default function Home() {
  const [activeTab, setActiveTab] = useState<'ALL'|'CAPEX'|'OPEX'>('CAPEX');

  const breadcrumbLabel = activeTab === 'OPEX' ? 'OPEX stock' : activeTab === 'CAPEX' ? 'CAPEX assets' : 'All items';

  useEffect(() => {
    // placeholder: Chart components will initialize later
  }, []);

  return (
    <div className="app-root" style={{ display: "flex", width: "100%", height: "100vh" }}>
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-name">AyurVaidya</div>
          <div className="logo-sub">All India Institute of<br/>Ayurveda, Faridabad</div>
          <div className="logo-pill">AIIA · AYUSH</div>
        </div>

        <nav>
          <div className="nav-block">
            <div className="nav-label">Main</div>
            <div className="nav-item active"><div className="nav-icon">▦</div> Dashboard</div>
            <div className="nav-item"><div className="nav-icon">☰</div> Item Registry</div>
            <div className="nav-item"><div className="nav-icon">↓</div> Stock Inward</div>
            <div className="nav-item"><div className="nav-icon">↑</div> Stock Issue</div>
          </div>

          <div className="nav-block">
            <div className="nav-label">Insights</div>
            <div className="nav-item"><div className="nav-icon">⚑</div> Alerts <span className="nav-chip">22</span></div>
            <div className="nav-item"><div className="nav-icon">≡</div> Reports</div>
            <div className="nav-item"><div className="nav-icon">✦</div> AI Assistant</div>
          </div>

          <div className="nav-block">
            <div className="nav-label">Category</div>
            <div className="nav-item" style={{ color: "rgba(255,255,255,0.9)" }}>
              <div className="nav-icon" style={{ color: "#93c5fd" }}>◈</div> CAPEX items
              <span className="nav-chip amber">3 AMC</span>
            </div>
            <div className="nav-item"><div className="nav-icon" style={{ color: "#86efac" }}>◉</div> OPEX items <span className="nav-chip">7</span></div>
          </div>
        </nav>

        <div className="sidebar-user">
          <div className="avatar">RK</div>
          <div className="user-info">
            <div className="user-name">Ramesh Kumar</div>
            <div className="user-role">Store Manager</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="page-title">Dashboard</div>
            <div className="breadcrumb">/ <span>{breadcrumbLabel}</span></div>
          </div>
          <div className="topbar-right">
            <div className="status-pill"><div className="status-dot"></div> System online</div>
            <div className="date-chip">21 Apr 2025</div>
            <div className="icon-btn">🔔<div className="notif-badge">7</div></div>
            <div className="icon-btn">⚙</div>
          </div>
        </header>

        <div className="tab-bar">
          <div className={`tab ${activeTab==='ALL'?'active':''}`} onClick={()=>setActiveTab('ALL')}>All items</div>
          <div className={`tab ${activeTab==='CAPEX'?'active':''}`} onClick={()=>setActiveTab('CAPEX')}>CAPEX only</div>
          <div className={`tab ${activeTab==='OPEX'?'active':''}`} onClick={()=>setActiveTab('OPEX')}>OPEX only</div>
        </div>

        <div className="content">
          {activeTab === 'OPEX' ? (
            <OpexDashboard />
          ) : (
          <>
          <div className="section-head">
            <span className="capex-badge">CAPEX</span>
            <span className="section-title">Capital assets — devices &amp; electrical</span>
            <span className="section-sub">Long-life items &nbsp;·&nbsp; AMC tracked &nbsp;·&nbsp; No expiry</span>
          </div>

          <div className="grid g-3" style={{ marginBottom: 12 }}>
            <div className="kpi-card g"><div className="kpi-num green">80</div><div className="kpi-lbl">Total CAPEX items</div><div className="kpi-sub">registered in system</div></div>
            <div className="kpi-card b"><div className="kpi-num blue">48</div><div className="kpi-lbl">Medical devices</div><div className="kpi-sub">BP monitors, thermometers…</div></div>
            <div className="kpi-card r"><div className="kpi-num red">3</div><div className="kpi-lbl">AMC renewals due</div><div className="kpi-sub">within 60 days — action needed</div></div>
          </div>

          <div className="grid g-2-1" style={{ marginBottom: 12 }}>
            <div className="card">
              <div className="card-head">
                <span className="card-title">Asset breakdown</span>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div className="legend-item"><div className="legend-sq" style={{ background: "var(--blue)" }}></div>Medical device</div>
                    <div className="legend-item"><div className="legend-sq" style={{ background: "var(--green)" }}></div>Electrical</div>
                  </div>
                  <a className="view-link">View all →</a>
                </div>
              </div>
              <div className="card-body" style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
                <div style={{ flexShrink: 0 }}>
                  <div className="donut-row">
                    <svg width="96" height="96" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="36" fill="none" stroke="#e8eee9" strokeWidth="13"/>
                      <circle cx="48" cy="48" r="36" fill="none" stroke="#185FA5" strokeWidth="13" strokeDasharray="135.7 90.5" strokeDashoffset="56.6"/>
                      <circle cx="48" cy="48" r="36" fill="none" stroke="#1A6B3C" strokeWidth="13" strokeDasharray="90.5 135.7" strokeDashoffset="-79.1"/>
                      <text x="48" y="44" textAnchor="middle" fontSize="17" fontWeight="500" fill="#0d1f12" fontFamily="'DM Mono',monospace">80</text>
                      <text x="48" y="57" textAnchor="middle" fontSize="9" fill="#7a9982" fontFamily="'Sora',sans-serif">total</text>
                    </svg>
                    <div className="leg-block">
                      <div className="leg-item"><div className="leg-sq" style={{ background: "#185FA5" }}></div>Medical devices <span className="leg-val">48<span className="leg-pct">60%</span></span></div>
                      <div className="leg-item"><div className="leg-sq" style={{ background: "#1A6B3C" }}></div>Electrical <span className="leg-val">32<span className="leg-pct">40%</span></span></div>
                    </div>
                  </div>
                </div>

                <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch", flexShrink: 0 }}></div>

                <div style={{ flex: 1 }}>
                  <div className="hbar-list">
                    <div className="hbar-row">
                      <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: "var(--blue)" }}></span>BP monitors &amp; diagnostics</span><span className="hbar-val">18</span></div>
                      <div className="hbar-track"><div className="hbar-fill" style={{ width: "38%", background: "var(--blue)" }}></div></div>
                    </div>
                    <div className="hbar-row">
                      <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: "var(--blue)" }}></span>Weighing &amp; measuring</span><span className="hbar-val">10</span></div>
                      <div className="hbar-track"><div className="hbar-fill" style={{ width: "21%", background: "var(--blue)" }}></div></div>
                    </div>
                    <div className="hbar-row">
                      <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: "var(--blue)" }}></span>Other devices</span><span className="hbar-val">20</span></div>
                      <div className="hbar-track"><div className="hbar-fill" style={{ width: "42%", background: "var(--blue)" }}></div></div>
                    </div>

                    <div className="section-divider"></div>

                    <div className="hbar-row">
                      <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: "var(--green)" }}></span>Ceiling fans</span><span className="hbar-val">20</span></div>
                      <div className="hbar-track"><div className="hbar-fill" style={{ width: "42%", background: "var(--green)" }}></div></div>
                    </div>
                    <div className="hbar-row">
                      <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: "var(--green)" }}></span>Air conditioners</span><span className="hbar-val">12</span></div>
                      <div className="hbar-track"><div className="hbar-fill" style={{ width: "25%", background: "var(--green)" }}></div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><span className="card-title">AMC renewals due</span><a className="view-link">View report →</a></div>
              <div className="card-body">
                <table className="amc-table">
                  <thead>
                    <tr><th>Item &amp; location</th><th>Vendor</th><th style={{ textAlign: "right" }}>Due in</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className="item-name">AC Unit</div>
                        <div className="item-loc">OPD Room 3</div>
                        <div className="mini-bar-wrap"><div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: "42%", background: "#E24B4A" }}></div></div></div>
                      </td>
                      <td><div className="vendor-txt">Cool Air Services</div></td>
                      <td style={{ textAlign: "right" }}><span className="pill pill-red">38 days</span></td>
                    </tr>
                    <tr>
                      <td>
                        <div className="item-name">BP Monitor</div>
                        <div className="item-loc">Ward B</div>
                        <div className="mini-bar-wrap"><div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: "58%", background: "#EF9F27" }}></div></div></div>
                      </td>
                      <td><div className="vendor-txt">MedEquip Co.</div></td>
                      <td style={{ textAlign: "right" }}><span className="pill pill-amber">52 days</span></td>
                    </tr>
                    <tr>
                      <td>
                        <div className="item-name">Water Purifier</div>
                        <div className="item-loc">Pharmacy</div>
                        <div className="mini-bar-wrap"><div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: "64%", background: "#EF9F27" }}></div></div></div>
                      </td>
                      <td><div className="vendor-txt">AquaCare Ltd.</div></td>
                      <td style={{ textAlign: "right" }}><span className="pill pill-amber">58 days</span></td>
                    </tr>
                    <tr>
                      <td>
                        <div className="item-name">Geyser</div>
                        <div className="item-loc">IPD Ward A</div>
                        <div className="mini-bar-wrap"><div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: "100%", background: "var(--green)" }}></div></div></div>
                      </td>
                      <td><div className="vendor-txt">HeatPro Services</div></td>
                      <td style={{ textAlign: "right" }}><span className="pill pill-green">90 days</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="card-foot"><span className="foot-txt">Total AMC contracts &nbsp;<strong>18</strong></span><span className="foot-txt" style={{ color: "var(--red)" }}>Already expired &nbsp;<strong>1</strong></span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="card-title">New CAPEX items added — last 6 months</span><a className="view-link">View GRN report →</a></div>
            <div className="card-body">
              <div className="chart-with-summary">
                <div className="chart-col">
                  <div className="chart-legend">
                    <div className="legend-item"><div className="legend-sq" style={{ background: "var(--blue)" }}></div>Medical devices</div>
                    <div className="legend-item"><div className="legend-sq" style={{ background: "var(--green)" }}></div>Electrical</div>
                  </div>
                    <div className="chart-wrap">
                      <BarChart />
                    </div>
                </div>

                <div className="summary-col">
                  <div className="sum-block"><div className="sum-lbl">Total this year</div><div className="sum-num">26</div><div className="sum-sub">↑ 18% vs last year</div></div>
                  <div style={{ height: 1, background: "var(--border)" }}></div>
                  <div className="sum-block"><div className="sum-lbl">Peak month</div><div className="sum-num-sm">Feb &nbsp;<span style={{ color: "var(--green)" }}>6 items</span></div></div>
                  <div style={{ height: 1, background: "var(--border)" }}></div>
                  <div className="sum-block"><div className="sum-lbl">Devices added</div><div className="sum-num-sm" style={{ color: "var(--blue)" }}>16 items</div></div>
                  <div style={{ height: 1, background: "var(--border)" }}></div>
                  <div className="sum-block"><div className="sum-lbl">Electrical added</div><div className="sum-num-sm" style={{ color: "var(--green)" }}>10 items</div></div>
                  <div style={{ height: 1, background: "var(--border)" }}></div>
                  <div className="sum-block"><div className="sum-lbl">Monthly average</div><div className="sum-num-sm">4.3 items</div></div>
                </div>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
