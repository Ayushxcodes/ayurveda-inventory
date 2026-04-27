"use client";

export default function StatStrip() {
  return (
    <div className="stat-strip">
      <div className="stat-cell">
        <div className="stat-val">248</div>
        <div className="stat-lbl">Total items in system</div>
        <div className="tag-row">
          <span className="tag tag-blue">80 CAPEX</span>
          <span className="tag tag-green">168 OPEX</span>
        </div>
      </div>
      <div className="stat-sep" />
      <div className="stat-cell">
        <div className="stat-val" style={{ color: 'var(--red)' }}>22</div>
        <div className="stat-lbl">Active alerts right now</div>
        <div className="tag-row">
          <span className="tag tag-red">7 expiry</span>
          <span className="tag tag-amber">12 low stock</span>
          <span className="tag tag-blue">3 AMC due</span>
        </div>
      </div>
      <div className="stat-sep" />
      <div className="stat-cell">
        <div className="stat-val" style={{ color: 'var(--green)' }}>23</div>
        <div className="stat-lbl">GRN entries this month</div>
        <div className="tag-row">
          <span className="tag tag-green">61 issues</span>
          <span className="tag tag-slate">₹4.2L received</span>
        </div>
      </div>
    </div>
  );
}
