"use client";

export default function ActivityPanel() {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Recent activity</span>
        <a className="view-link">View full log →</a>
      </div>
      <div className="panel-body" style={{ padding: '0 16px' }}>
        <div className="activity-list">
          <div className="act-row">
            <div className="act-icon green">↓</div>
            <div className="act-content">
              <div className="act-title">GRN recorded — Brahmi Tail <span className="pill pill-green" style={{ marginLeft: 4 }}>10,000 ml</span></div>
              <div className="act-detail">Rajiv Ayurvedic Supplies · Batch BT-2024-089 · Exp: May 2026</div>
            </div>
            <div className="act-time">2h ago</div>
          </div>

          <div className="act-row">
            <div className="act-icon red">⚑</div>
            <div className="act-content">
              <div className="act-title">Alert — Neem Tail expiry <span className="pill pill-red" style={{ marginLeft: 4 }}>12 days</span></div>
              <div className="act-detail">320 ml remaining · Shalakya Tantra dept</div>
            </div>
            <div className="act-time">5h ago</div>
          </div>

          <div className="act-row">
            <div className="act-icon green">↑</div>
            <div className="act-content">
              <div className="act-title">Stock issued — Ashwagandha Churna <span className="pill pill-green" style={{ marginLeft: 4 }}>500 g</span></div>
              <div className="act-detail">Issued to Pharmacy Counter · Dr. S. Verma · 21 Apr</div>
            </div>
            <div className="act-time">Yesterday</div>
          </div>

          <div className="act-row">
            <div className="act-icon blue">📋</div>
            <div className="act-content">
              <div className="act-title">AMC alert — AC Unit OPD Room 3 <span className="pill pill-red" style={{ marginLeft: 4 }}>38 days</span></div>
              <div className="act-detail">Cool Air Services · Contact vendor for renewal</div>
            </div>
            <div className="act-time">Yesterday</div>
          </div>

          <div className="act-row">
            <div className="act-icon amber">↓</div>
            <div className="act-content">
              <div className="act-title">GRN recorded — Cotton Bandages <span className="pill pill-amber" style={{ marginLeft: 4 }}>500 rolls</span></div>
              <div className="act-detail">MedPlus Supplies · Still below minimum — reorder more</div>
            </div>
            <div className="act-time">2 days ago</div>
          </div>
        </div>
      </div>
    </div>
  );
}
