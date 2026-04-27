"use client";

export default function AttentionCard() {
  return (
    <div className="attention-card">
      <div className="attention-head">
        <div className="attention-title">Needs attention right now</div>
        <div className="attention-sub">Items requiring action — across both CAPEX and OPEX</div>
      </div>
      <div className="attention-grid">
        <div className="attn-col">
          <div className="attn-big" style={{ color: 'var(--red)' }}>7</div>
          <div className="attn-lbl">Expiring in 30 days</div>
          <div className="attn-list">
            <div className="attn-row"><div className="dot dot-red" /> <span className="attn-name">Neem Tail</span> <span className="pill pill-red">12 days</span></div>
            <div className="attn-row"><div className="dot dot-red" /> <span className="attn-name">Haritaki Churna</span> <span className="pill pill-red">18 days</span></div>
            <div className="attn-row"><div className="dot dot-red" /> <span className="attn-name">Chyawanprash</span> <span className="pill pill-red">27 days</span></div>
            <div className="attn-more">+4 more → OPEX tab</div>
          </div>
        </div>

        <div className="attn-col">
          <div className="attn-big" style={{ color: 'var(--amber)' }}>12</div>
          <div className="attn-lbl">Low stock — reorder needed</div>
          <div className="attn-list">
            <div className="attn-row"><div className="dot dot-amber" /> <span className="attn-name">Cotton Bandages</span> <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto' }}>21%</span></div>
            <div className="attn-row"><div className="dot dot-amber" /> <span className="attn-name">Surgical Gloves (M)</span> <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto' }}>15%</span></div>
            <div className="attn-row"><div className="dot dot-amber" /> <span className="attn-name">Triphala Churna</span> <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto' }}>24%</span></div>
            <div className="attn-more">+9 more → OPEX tab</div>
          </div>
        </div>

        <div className="attn-col">
          <div className="attn-big" style={{ color: 'var(--blue)' }}>3</div>
          <div className="attn-lbl">AMC renewals due (60 days)</div>
          <div className="attn-list">
            <div className="attn-row"><div className="dot dot-blue" /> <span className="attn-name">AC Unit — OPD Rm 3</span> <span className="pill pill-red">38d</span></div>
            <div className="attn-row"><div className="dot dot-blue" /> <span className="attn-name">BP Monitor — Ward B</span> <span className="pill pill-amber">52d</span></div>
            <div className="attn-row"><div className="dot dot-blue" /> <span className="attn-name">Water Purifier — Pharm.</span> <span className="pill pill-amber">58d</span></div>
            <div className="attn-more">Full list → CAPEX tab</div>
          </div>
        </div>

        <div className="attn-col danger-bg">
          <div className="attn-big" style={{ color: 'var(--red)' }}>2</div>
          <div className="attn-lbl">Already expired — dispose now</div>
          <div className="attn-list">
            <div className="attn-row"><div className="dot dot-red" /> <span className="attn-name">Neem Tail</span> <span style={{ fontSize: '10px', color: 'var(--red)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>3d ago</span></div>
            <div className="attn-row"><div className="dot dot-red" /> <span className="attn-name">Haritaki Churna (B2)</span> <span style={{ fontSize: '10px', color: 'var(--red)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>1d ago</span></div>
          </div>
          <div className="danger-notice">Dispose per AYUSH guidelines immediately. Log disposal in system.</div>
        </div>
      </div>
    </div>
  );
}
