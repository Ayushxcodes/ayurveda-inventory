"use client";

import React from "react";
import "./sidebar.css";

export type NavTab = "ALL" | "CAPEX" | "OPEX" | "REG" | "GRN" | "ISS";

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  grnView: "grn" | "qr";
  setGrnView: (view: "grn" | "qr") => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  grnView,
  setGrnView,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const isDashboardActive =
    activeTab === "ALL" ||
    (activeTab !== "REG" &&
      activeTab !== "GRN" &&
      activeTab !== "ISS" &&
      activeTab !== "CAPEX" &&
      activeTab !== "OPEX");

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        {/* ── Brand Logo Area ─────────────────────────────────── */}
        <div className="logo-area">
          <div className="brand-row">
            <div className="brand-emblem" title="All India Institute of Ayurveda">
              {/* Botanical Ayurvedic Leaf Emblem */}
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2C6.477 2 2 6.477 2 12c0 3.2 1.5 6.05 3.828 7.89.47.37.98.69 1.52.95C8.84 21.57 10.37 22 12 22s3.16-.43 4.652-1.16c.54-.26 1.05-.58 1.52-.95C20.5 18.05 22 15.2 22 12c0-5.523-4.477-10-10-10z"
                  fill="currentColor"
                  fillOpacity="0.15"
                />
                <path
                  d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 2.43.867 4.656 2.316 6.388L12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 12c1.8-3.2 4.4-4.8 7.2-4.8 0 3-1.8 5.6-5 7.2"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 12c-1.8 3.2-4.4 4.8-7.2 4.8 0-3 1.8-5.6 5-7.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="brand-info">
              <div className="logo-name">
                AyurVaidya
                <span className="logo-dot" />
              </div>
              <div className="logo-sub" title="All India Institute of Ayurveda, Faridabad">
                AIIA · Faridabad Campus
              </div>
            </div>
          </div>
          <div className="logo-pill">
            <span className="live-indicator" />
            <span>AIIA · MoA AYUSH ERP</span>
          </div>
        </div>

        {/* ── Navigation Items ────────────────────────────────── */}
        <nav>
          {/* Main Block */}
          <div className="nav-block">
            <div className="nav-label">Main Navigation</div>

            {/* Dashboard */}
            <div
              className={`nav-item ${isDashboardActive ? "active" : ""}`}
              onClick={() => {
                setActiveTab("ALL");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" />
                </svg>
              </div>
              <span>Dashboard</span>
            </div>

            {/* Item Registry */}
            <div
              className={`nav-item ${activeTab === "REG" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("REG");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="3" stroke="currentColor" />
                  <path d="M20.2 20.2L22 22" strokeLinecap="round" />
                </svg>
              </div>
              <span>Item Registry</span>
            </div>

            {/* Stock Inward (GRN) */}
            <div
              className={`nav-item ${activeTab === "GRN" && grnView === "grn" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("GRN");
                setGrnView("grn");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" strokeLinecap="round" />
                </svg>
              </div>
              <span>Stock Inward</span>
            </div>

            {/* QR Generator */}
            <div
              className={`nav-item ${activeTab === "GRN" && grnView === "qr" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("GRN");
                setGrnView("qr");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" />
                  <rect x="15" y="3" width="6" height="6" rx="1" stroke="currentColor" />
                  <rect x="3" y="15" width="6" height="6" rx="1" stroke="currentColor" />
                  <path d="M15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" fill="currentColor" />
                </svg>
              </div>
              <span>QR Generator</span>
            </div>

            {/* Stock Issue */}
            <div
              className={`nav-item ${activeTab === "ISS" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("ISS");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 15V3m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" strokeLinecap="round" />
                </svg>
              </div>
              <span>Stock Issue</span>
            </div>
          </div>

          {/* Insights Block */}
          <div className="nav-block">
            <div className="nav-label">Insights & Audits</div>

            {/* Alerts */}
            <div
              className="nav-item"
              onClick={() => {
                // Focus on items needing attention
                try {
                  sessionStorage.setItem(
                    "registryDeepLink",
                    JSON.stringify({
                      status: "critical",
                      bannerMsg: "← All critical and expiring inventory alerts",
                    })
                  );
                  window.dispatchEvent(new CustomEvent("open-registry"));
                } catch {}
                setActiveTab("REG");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span>Alerts</span>
              <span className="nav-chip">22</span>
            </div>

            {/* Reports */}
            <div
              className="nav-item"
              onClick={() => {
                setActiveTab("CAPEX");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span>AMC Reports</span>
            </div>

            {/* AI Assistant */}
            <div
              className="nav-item"
              onClick={() => {
                setActiveTab("OPEX");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon" style={{ color: "#c084fc" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 2l2.4 5.6L20 10l-4.4 4 1.4 6-5-3.2-5 3.2 1.4-6L4 10l5.6-2.4L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span>AI Anomaly ML</span>
            </div>
          </div>

          {/* Categories Block */}
          <div className="nav-block">
            <div className="nav-label">Inventory Categories</div>

            {/* CAPEX items */}
            <div
              className={`nav-item ${activeTab === "CAPEX" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("CAPEX");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon" style={{ color: "#93c5fd" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" />
                  <path d="M8 21h8M12 17v4" strokeLinecap="round" />
                </svg>
              </div>
              <span>CAPEX Assets</span>
              <span className="nav-chip amber">3 AMC</span>
            </div>

            {/* OPEX items */}
            <div
              className={`nav-item ${activeTab === "OPEX" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("OPEX");
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="nav-icon" style={{ color: "#86efac" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M10 2v4a2 2 0 002 2h0a2 2 0 002-2V2M14 6l4.5 9A4 4 0 0115 21H9a4 4 0 01-3.5-6L10 6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 16h10" strokeLinecap="round" />
                </svg>
              </div>
              <span>OPEX Consumables</span>
              <span className="nav-chip green">Active</span>
            </div>
          </div>
        </nav>

        {/* ── User Profile Card Footer ────────────────────────── */}
        <div className="sidebar-user">
          <div className="user-card">
            <div className="avatar-wrapper">
              <div className="avatar">RK</div>
              <span className="avatar-dot" />
            </div>
            <div className="user-info">
              <div className="user-name">Ramesh Kumar</div>
              <div className="user-role">Store Manager</div>
              <div className="user-badge">● Online · AYUSH Verified</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
