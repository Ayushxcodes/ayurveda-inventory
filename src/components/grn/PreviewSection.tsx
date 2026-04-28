import React from "react";

export default function PreviewSection({ title, rows }: {
  title: string;
  rows: [string, string, string?][];
}) {
  return (
    <div className="preview-section">
      <div className="ps-title">{title}</div>
      {rows.map(([lbl, val, cls = ""]) => (
        <div key={lbl} className="ps-row">
          <span className="ps-lbl">{lbl}</span>
          <span className={`ps-val ${cls}`}>{val}</span>
        </div>
      ))}
    </div>
  );
}
