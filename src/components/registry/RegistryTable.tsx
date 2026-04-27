"use client";

import React from "react";
import { Item, stockPct, expiryLabel, stockBarColor } from "./utils";
import StatusPill from "./StatusPill";

export default function RegistryTable({
  items,
  highlight,
  onRowClick,
  highlightRef,
}: {
  items: Item[];
  highlight: string | null;
  onRowClick: (item: Item) => void;
  highlightRef: React.RefObject<HTMLTableRowElement | null>;
}) {
  return (
    <div className="table-wrap">
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">No items match your filters</div>
          <div className="empty-sub">Try adjusting the category, status, or search term</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Item name</th>
              <th>Category</th>
              <th>Sub-type</th>
              <th>Stock / Qty</th>
              <th>Expiry / AMC</th>
              <th>Department</th>
              <th>Status</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const pct = stockPct(item);
              const exp = expiryLabel(item);
              const isHL = highlight === item.id;

              const stockDisp = item.category === "CAPEX" ? (
                <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{item.stock} {item.unit}</span>
              ) : (
                <div className="stock-cell">
                  <div className="stock-nums">{item.stock.toLocaleString()} / {item.min.toLocaleString()} {item.unit}</div>
                  <div className="stock-bar-track">
                    <div className="stock-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: stockBarColor(item) }} />
                  </div>
                </div>
              );

              return (
                <tr
                  key={item.id}
                  className={isHL ? "highlighted" : ""}
                  style={{ animationDelay: `${idx * 0.02}s` }}
                  ref={isHL ? (el) => { if (el) highlightRef.current = el; } : undefined}
                  data-id={item.id}
                  onClick={() => onRowClick(item)}
                >
                  <td><span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{item.id}</span></td>
                  <td>
                    <div className="item-name-cell">
                      <div className="item-name">{item.name}</div>
                      <div className="item-sub">{item.sub}</div>
                    </div>
                  </td>
                  <td><span className={`cat-badge ${item.category === "CAPEX" ? "cat-capex" : "cat-opex"}`}>{item.category}</span></td>
                  <td><span className="subcat-badge">{item.subcat}</span></td>
                  <td>{stockDisp}</td>
                  <td><span className={`expiry-cell ${exp.cls}`}>{exp.txt}</span></td>
                  <td><span className="dept-cell">{item.dept}</span></td>
                  <td><StatusPill status={item.status} /></td>
                  <td>
                    <div className="action-cell">
                      <button className="action-btn" onClick={(e) => { e.stopPropagation(); onRowClick(item); }}>View</button>
                      <button className="action-btn primary-sm" onClick={(e) => { e.stopPropagation(); alert((item.category === "OPEX" ? "Opening GRN" : "Details") + " for: " + item.name); }}>
                        {item.category === "OPEX" ? "GRN" : "Details"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
