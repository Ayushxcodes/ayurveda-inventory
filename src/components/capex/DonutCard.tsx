"use client";

export default function DonutCard(){
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Asset breakdown</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="legend-item"><div className="legend-sq" style={{ background: 'var(--blue)' }}></div>Medical device</div>
            <div className="legend-item"><div className="legend-sq" style={{ background: 'var(--green)' }}></div>Electrical</div>
          </div>
          <a className="view-link">View all →</a>
        </div>
      </div>
      <div className="card-body" style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
        <div style={{ flexShrink: 0 }}>
          <div className="donut-row">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="36" fill="none" stroke="#e8eee9" strokeWidth="13"/>
              <circle cx="48" cy="48" r="36" fill="none" stroke="#185FA5" strokeWidth="13" strokeDasharray="135.7 90.5" strokeDashoffset="56.6"/>
              <circle cx="48" cy="48" r="36" fill="none" stroke="#1A6B3C" strokeWidth="13" strokeDasharray="90.5 135.7" strokeDashoffset="-79.1"/>
              <text x="48" y="44" textAnchor="middle" fontSize="17" fontWeight={500} fill="#0d1f12" fontFamily="'DM Mono',monospace">80</text>
              <text x="48" y="57" textAnchor="middle" fontSize={9} fill="#7a9982" fontFamily="'Sora',sans-serif">total</text>
            </svg>
            <div className="leg-block">
              <div className="leg-item"><div className="leg-sq" style={{ background: '#185FA5' }}></div>Medical devices <span className="leg-val">48<span className="leg-pct">60%</span></span></div>
              <div className="leg-item"><div className="leg-sq" style={{ background: '#1A6B3C' }}></div>Electrical <span className="leg-val">32<span className="leg-pct">40%</span></span></div>
            </div>
          </div>
        </div>

        <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', flexShrink: 0 }}></div>

        <div style={{ flex: 1 }}>
          <div className="hbar-list">
            <div className="hbar-row">
              <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: 'var(--blue)' }}></span>BP monitors &amp; diagnostics</span><span className="hbar-val">18</span></div>
              <div className="hbar-track"><div className="hbar-fill" style={{ width: '38%', background: 'var(--blue)' }}></div></div>
            </div>
            <div className="hbar-row">
              <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: 'var(--blue)' }}></span>Weighing &amp; measuring</span><span className="hbar-val">10</span></div>
              <div className="hbar-track"><div className="hbar-fill" style={{ width: '21%', background: 'var(--blue)' }}></div></div>
            </div>
            <div className="hbar-row">
              <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: 'var(--blue)' }}></span>Other devices</span><span className="hbar-val">20</span></div>
              <div className="hbar-track"><div className="hbar-fill" style={{ width: '42%', background: 'var(--blue)' }}></div></div>
            </div>

            <div className="section-divider" />

            <div className="hbar-row">
              <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: 'var(--green)' }}></span>Ceiling fans</span><span className="hbar-val">20</span></div>
              <div className="hbar-track"><div className="hbar-fill" style={{ width: '42%', background: 'var(--green)' }}></div></div>
            </div>
            <div className="hbar-row">
              <div className="hbar-top"><span className="hbar-name"><span className="hbar-dot" style={{ background: 'var(--green)' }}></span>Air conditioners</span><span className="hbar-val">12</span></div>
              <div className="hbar-track"><div className="hbar-fill" style={{ width: '25%', background: 'var(--green)' }}></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
