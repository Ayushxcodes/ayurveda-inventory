"use client";

import React from "react";
import { FilterState } from "./utils";

export default function FilterBar({
  filters,
  setFilters,
  setCategory,
  setSubcat,
  setStatus,
  clearAllFilters,
}: {
  filters: FilterState;
  setFilters: (fn: any) => void;
  setCategory: (c: "all" | "OPEX" | "CAPEX") => void;
  setSubcat: (s: string) => void;
  setStatus: (s: string) => void;
  clearAllFilters: () => void;
}) {
  const chipClass = (base: string, type: string, activeWhen: boolean) =>
    `chip${activeWhen ? ` active ${type}` : ""}`;

  return (
    <div className="filter-bar">
      {filters.bannerMsg && (
        <div className="filter-banner show">
          <span style={{ fontSize: 14 }}>🔗</span>
          <span className="filter-banner-text">{filters.bannerMsg}</span>
          <span className="filter-banner-clear" onClick={clearAllFilters}>Clear filter ×</span>
        </div>
      )}
      <div className="filter-top">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, batch, department…"
            value={filters.search}
            onChange={(e) => setFilters((f: FilterState) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <button className="btn" onClick={() => alert("Column visibility panel — coming soon")}>⊞ Columns</button>
        <button className="btn" onClick={() => alert("Exporting to Excel…")}>↓ Export Excel</button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
          Total <strong style={{ color: "var(--text)", marginLeft: 3 }}>—</strong>
        </div>
      </div>

      <div className="filter-chips-row">
        <span className="filter-group-label">Category:</span>
        <span className={chipClass("chip", "all",   filters.category === "all")}   onClick={() => setCategory("all")}>All items</span>
        <span className={chipClass("chip", "capex", filters.category === "CAPEX")} onClick={() => setCategory("CAPEX")}>◈ CAPEX</span>
        <span className={chipClass("chip", "opex",  filters.category === "OPEX")}  onClick={() => setCategory("OPEX")}>◉ OPEX</span>

        <div className="filter-divider" />
        <span className="filter-group-label">Sub-type:</span>
        <span className={chipClass("chip", "devices",     filters.subcat === "devices")}     onClick={() => setSubcat("devices")}>🩺 Medical devices</span>
        <span className={chipClass("chip", "electrical",  filters.subcat === "electrical")}  onClick={() => setSubcat("electrical")}>💡 Electrical</span>
        <span className={chipClass("chip", "medicines",   filters.subcat === "medicines")}   onClick={() => setSubcat("medicines")}>🌿 Medicines</span>
        <span className={chipClass("chip", "consumables", filters.subcat === "consumables")} onClick={() => setSubcat("consumables")}>📦 Consumables</span>

        <div className="filter-divider" />
        <span className="filter-group-label">Status:</span>
        <span className={chipClass("chip", "expiring",  filters.status === "expiring")}  onClick={() => setStatus("expiring")}>⏰ Expiring soon</span>
        <span className={chipClass("chip", "expired",   filters.status === "expired")}   onClick={() => setStatus("expired")}>🚫 Expired</span>
        <span className={chipClass("chip", "low_stock", filters.status === "low_stock")} onClick={() => setStatus("low_stock")}>📉 Low stock</span>
        <span className={chipClass("chip", "amc_due",   filters.status === "amc_due")}   onClick={() => setStatus("amc_due")}>📋 AMC due</span>
        <span className={chipClass("chip", "healthy",   filters.status === "healthy")}   onClick={() => setStatus("healthy")}>✓ Healthy</span>
      </div>
    </div>
  );
}
