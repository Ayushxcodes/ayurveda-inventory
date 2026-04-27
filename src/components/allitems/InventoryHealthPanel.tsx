"use client";

export default function InventoryHealthPanel() {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Inventory health — overall status</span>
        <a className="view-link">View all alerts →</a>
      </div>
      <div className="panel-body">
        <div className="health-block">
          <div className="health-label-row">
            <div className="health-label-left"><div className="cat-dot" style={{ background: 'var(--blue)' }}></div><span>CAPEX — 80 items</span></div>
            <span className="health-status" style={{ color: 'var(--green)' }}>Good overall</span>
          </div>
          <div className="health-bar">
            <div className="hb" style={{ width: '70%', background: 'var(--green)' }}></div>
            <div className="hb" style={{ width: '26%', background: 'var(--amber)' }}></div>
            <div className="hb" style={{ width: '4%', background: 'var(--red)' }}></div>
          </div>
          <div className="health-legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--green)' }}></div>56 healthy</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--amber)' }}></div>21 AMC within 90d</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--red)' }}></div>3 AMC critical</div>
          </div>
        </div>

        <div className="health-block">
          <div className="health-label-row">
            <div className="health-label-left"><div className="cat-dot" style={{ background: 'var(--green)' }}></div><span>OPEX — 168 items</span></div>
            <span className="health-status" style={{ color: 'var(--amber)' }}>Attention needed</span>
          </div>
          <div className="health-bar">
            <div className="hb" style={{ width: '75%', background: 'var(--green)' }}></div>
            <div className="hb" style={{ width: '7%', background: 'var(--amber)' }}></div>
            <div className="hb" style={{ width: '13%', background: 'rgba(185,28,28,0.6)' }}></div>
            <div className="hb" style={{ width: '5%', background: 'var(--red)' }}></div>
          </div>
          <div className="health-legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--green)' }}></div>126 healthy</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--amber)' }}></div>12 low stock</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: 'rgba(185,28,28,0.6)' }}></div>7 expiring</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--red)' }}></div>2 expired</div>
          </div>
        </div>

        <div className="health-divider" />

        <div className="mini-stats">
          <div className="mini-stat"><div className="mini-val" style={{ color: 'var(--green)' }}>182</div><div className="mini-lbl">healthy items</div></div>
          <div className="mini-stat"><div className="mini-val" style={{ color: 'var(--amber)' }}>64</div><div className="mini-lbl">need attention</div></div>
          <div className="mini-stat"><div className="mini-val" style={{ color: 'var(--red)' }}>2</div><div className="mini-lbl">expired — act now</div></div>
        </div>
      </div>
    </div>
  );
}
