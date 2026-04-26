"use client";

export default function WastageCard(){
  const rows = [
    ['Haritaki Churna','1.6 kg','₹1,920',85],
    ['Neem Tail','280 ml','₹980',45],
    ['Chyawanprash','400 g','₹840',38],
    ['Surgical Gloves','18 pairs','₹720',32],
    ['Brahmi Tail','120 ml','₹360',16]
  ];

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Stock wastage — expiry</span>
        <a className="view-link">View report →</a>
      </div>
      <div className="card-body" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>Items expired before use — Mar 2025</div>
        <div className="sum-pills">
          <div className="s-pill"><div className="s-pill-val">5</div><div className="s-pill-lbl">items expired</div></div>
          <div className="s-pill"><div className="s-pill-val">₹4,820</div><div className="s-pill-lbl">value written off</div></div>
        </div>
        <div className="month-tabs">
          <div className="mtab">Jan</div>
          <div className="mtab">Feb</div>
          <div className="mtab active">Mar</div>
          <div className="mtab">Apr</div>
        </div>
        <div className="wastage-list">
          {rows.map((r,i)=> (
            <div className="w-row" key={i}>
              <div className="w-top"><span className="w-name">{r[0]}</span><span className="w-qty">{r[1]}</span><span className="w-val">{r[2]}</span></div>
              <div className="w-track"><div className="w-fill" style={{ width: `${r[3]}%` }}></div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card-foot">
        <span className="foot-txt">YTD wastage &nbsp;<strong>₹18,640</strong></span>
        <span className="foot-txt" style={{ color: 'var(--red)' }}>↑ 12% vs last year</span>
      </div>
    </div>
  );
}
