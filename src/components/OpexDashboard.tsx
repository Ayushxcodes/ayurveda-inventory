"use client";

import { useEffect, useRef } from "react";

export default function OpexDashboard() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // (styles removed — use global CSS or module styles instead)

    // inner content for the .content area (extracted from attachment)
    const html = `
<div class="section-head">
  <span class="opex-badge">OPEX</span>
  <span class="section-title">Operating stock — medicines &amp; consumables</span>
  <span class="section-sub">Regular purchase · Expiry tracked · Stock replenished</span>
</div>

<!-- ROW 1: Donut + 3 KPIs -->
<div class="grid" style="grid-template-columns:1fr 1fr 1fr 1fr;margin-bottom:12px">
  <div class="card">
    <div class="card-head"><span class="card-title">Total OPEX items</span><a class="view-link">View all →</a></div>
    <div class="card-body" style="justify-content:center;padding:12px 14px">
      <div class="donut-row">
        <svg width="80" height="80" viewBox="0 0 80 80" style="flex-shrink:0">
          <circle cx="40" cy="40" r="29" fill="none" stroke="#e8eee9" stroke-width="11"/>
          <circle cx="40" cy="40" r="29" fill="none" stroke="#1A6B3C" stroke-width="11"
            stroke-dasharray="153.9 28.3" stroke-dashoffset="45.6"/>
          <circle cx="40" cy="40" r="29" fill="none" stroke="#185FA5" stroke-width="11"
            stroke-dasharray="28.3 153.9" stroke-dashoffset="-108.3"/>
          <text x="40" y="36" text-anchor="middle" font-size="14" font-weight="500"
            fill="#0d1f12" font-family="'DM Mono',monospace">168</text>
          <text x="40" y="48" text-anchor="middle" font-size="8"
            fill="#7a9982" font-family="'Sora',sans-serif">total</text>
        </svg>
        <div class="leg-block">
          <div class="leg-item"><div class="leg-sq" style="background:#1A6B3C"></div>Medicines<span class="leg-val">142<span class="leg-pct">85%</span></span></div>
          <div class="leg-item"><div class="leg-sq" style="background:#185FA5"></div>Consumables<span class="leg-val">26<span class="leg-pct">15%</span></span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="kpi-card r" style="animation-delay:.06s">
    <div class="kpi-num red">7</div>
    <div class="kpi-lbl">Expiring in 30 days</div>
    <div class="kpi-sub">urgent action needed</div>
  </div>
  <div class="kpi-card a" style="animation-delay:.10s">
    <div class="kpi-num amber">12</div>
    <div class="kpi-lbl">Low stock items</div>
    <div class="kpi-sub">below minimum level</div>
  </div>
  <div class="kpi-card n" style="animation-delay:.14s">
    <div class="kpi-num" style="color:var(--text)">23</div>
    <div class="kpi-lbl">GRN this month</div>
    <div class="kpi-sub">61 issues this month</div>
  </div>
</div>

<!-- ROW 2: Expiry pipeline + Low stock -->
<div class="grid g-2" style="margin-bottom:12px">
  <div class="card">
    <div class="card-head">
      <span class="card-title">Expiry pipeline</span>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="aleg">
          <div class="aleg-item"><div class="aleg-sq" style="background:#B91C1C"></div>Critical &lt;30d</div>
          <div class="aleg-item"><div class="aleg-sq" style="background:#92400E"></div>Urgent &lt;60d</div>
          <div class="aleg-item"><div class="aleg-sq" style="background:#78600A"></div>Monitor &lt;90d</div>
          <div class="aleg-item"><div class="aleg-sq" style="background:#1A6B3C"></div>Healthy</div>
        </div>
        <a class="view-link">View all →</a>
      </div>
    </div>
    <div class="card-body">
      <div class="chart-with-summary">
        <div class="chart-col">
          <div class="chart-wrap" style="height:155px"><canvas id="expiryChart"></canvas></div>
        </div>
        <div class="summary-col">
          <div><div class="sum-lbl">Total items</div><div class="sum-num">168</div></div>
          <div class="vdivider"></div>
          <div><div class="sum-lbl">Already expired</div><div class="sum-num-sm" style="color:var(--red)">2 items</div></div>
          <div class="vdivider"></div>
          <div><div class="sum-lbl">Critical this month</div><div class="sum-num-sm" style="color:var(--amber)">7 items</div></div>
          <div class="vdivider"></div>
          <div><div class="sum-lbl">Healthy</div><div class="sum-num-sm" style="color:var(--green)">126 items</div></div>
        </div>
      </div>
    </div>
    <div class="card-foot">
      <span class="foot-txt">Expiring &lt;30d &nbsp;<strong style="color:var(--red)">7</strong></span>
      <span class="foot-txt">Expiring &lt;60d &nbsp;<strong style="color:var(--amber)">14</strong></span>
      <span class="foot-txt">Expiring &lt;90d &nbsp;<strong style="color:var(--yellow)">21</strong></span>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><span class="card-title">Low stock — needs reorder</span><a class="view-link">View all →</a></div>
    <div class="card-body" style="justify-content:center">
      <div class="stock-list">
        <div class="stock-row">
          <div class="stock-top"><span class="stock-name">Cotton Bandages</span><span class="stock-nums">210/1,000 rolls</span><span class="pill pill-red" style="margin-left:6px">Critical</span></div>
          <div class="stock-track"><div class="stock-fill" style="width:21%;background:var(--red)"></div></div>
        </div>
        <div class="stock-row">
          <div class="stock-top"><span class="stock-name">Surgical Gloves (M)</span><span class="stock-nums">30/200 pairs</span><span class="pill pill-red" style="margin-left:6px">Critical</span></div>
          <div class="stock-track"><div class="stock-fill" style="width:15%;background:var(--red)"></div></div>
        </div>
        <div class="stock-row">
          <div class="stock-top"><span class="stock-name">Triphala Churna</span><span class="stock-nums">480/2,000 g</span><span class="pill pill-amber" style="margin-left:6px">Low</span></div>
          <div class="stock-track"><div class="stock-fill" style="width:24%;background:var(--amber)"></div></div>
        </div>
        <div class="stock-row">
          <div class="stock-top"><span class="stock-name">Neem Tail</span><span class="stock-nums">320/500 ml</span><span class="pill pill-amber" style="margin-left:6px">Low</span></div>
          <div class="stock-track"><div class="stock-fill" style="width:64%;background:var(--amber)"></div></div>
        </div>
        <div class="stock-row">
          <div class="stock-top"><span class="stock-name">Brahmi Tail</span><span class="stock-nums">380/1,000 ml</span><span class="pill pill-amber" style="margin-left:6px">Low</span></div>
          <div class="stock-track"><div class="stock-fill" style="width:38%;background:var(--amber)"></div></div>
        </div>
        <div class="stock-row">
          <div class="stock-top"><span class="stock-name">Ashwagandha Churna</span><span class="stock-nums">4,200/1,000 g</span><span class="pill pill-green" style="margin-left:6px">Healthy</span></div>
          <div class="stock-track"><div class="stock-fill" style="width:100%;background:var(--green)"></div></div>
        </div>
      </div>
    </div>
    <div class="card-foot">
      <span class="foot-txt">Critical &nbsp;<strong style="color:var(--red)">2</strong></span>
      <span class="foot-txt">Low &nbsp;<strong style="color:var(--amber)">3</strong></span>
      <span class="foot-txt">Healthy &nbsp;<strong style="color:var(--green)">1</strong></span>
    </div>
  </div>
</div>

<!-- ROW 3: Anomaly tracker + Wastage -->
<div class="grid g-2-1" style="margin-bottom:0">
  <div class="card">
    <div class="card-head">
      <span class="card-title">Consumption anomaly tracker — top 5 products (last 6 months)</span>
      <a class="view-link">View report →</a>
    </div>
    <div class="card-body" style="padding:12px 15px 10px">
      <div class="product-tabs" id="productTabs"></div>
      <div class="aleg">
        <div class="aleg-item"><div class="aleg-sq" style="background:#185FA5;opacity:0.65"></div>Monthly usage</div>
        <div class="aleg-item"><div class="aleg-line"></div>6-month avg</div>
        <div class="aleg-item"><div class="aleg-dot"></div>Anomaly spike</div>
      </div>
      <div class="chart-wrap" style="height:165px"><canvas id="anomalyChart"></canvas></div>
      <div id="anomalyNote" style="margin-top:8px;padding:7px 10px;border-radius:var(--r-md);font-size:11px;display:none"></div>
    </div>
    <div class="card-foot">
      <span class="foot-txt" id="footLeft"></span>
      <span class="foot-txt" id="footRight"></span>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <span class="card-title">Stock wastage — expiry</span>
      <a class="view-link">View report →</a>
    </div>
    <div class="card-body" style="padding:12px 14px">
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">Items expired before use — Mar 2025</div>
      <div class="sum-pills">
        <div class="s-pill"><div class="s-pill-val">5</div><div class="s-pill-lbl">items expired</div></div>
        <div class="s-pill"><div class="s-pill-val">₹4,820</div><div class="s-pill-lbl">value written off</div></div>
      </div>
      <div class="month-tabs">
        <div class="mtab" onclick="switchMTab(this)">Jan</div>
        <div class="mtab" onclick="switchMTab(this)">Feb</div>
        <div class="mtab active" onclick="switchMTab(this)">Mar</div>
        <div class="mtab" onclick="switchMTab(this)">Apr</div>
      </div>
      <div class="wastage-list">
        <div class="w-row">
          <div class="w-top"><span class="w-name">Haritaki Churna</span><span class="w-qty">1.6 kg</span><span class="w-val">₹1,920</span></div>
          <div class="w-track"><div class="w-fill" style="width:85%"></div></div>
        </div>
        <div class="w-row">
          <div class="w-top"><span class="w-name">Neem Tail</span><span class="w-qty">280 ml</span><span class="w-val">₹980</span></div>
          <div class="w-track"><div class="w-fill" style="width:45%"></div></div>
        </div>
        <div class="w-row">
          <div class="w-top"><span class="w-name">Chyawanprash</span><span class="w-qty">400 g</span><span class="w-val">₹840</span></div>
          <div class="w-track"><div class="w-fill" style="width:38%"></div></div>
        </div>
        <div class="w-row">
          <div class="w-top"><span class="w-name">Surgical Gloves</span><span class="w-qty">18 pairs</span><span class="w-val">₹720</span></div>
          <div class="w-track"><div class="w-fill" style="width:32%"></div></div>
        </div>
        <div class="w-row">
          <div class="w-top"><span class="w-name">Brahmi Tail</span><span class="w-qty">120 ml</span><span class="w-val">₹360</span></div>
          <div class="w-track"><div class="w-fill" style="width:16%"></div></div>
        </div>
      </div>
    </div>
    <div class="card-foot">
      <span class="foot-txt">YTD wastage &nbsp;<strong>₹18,640</strong></span>
      <span class="foot-txt" style="color:var(--red)">↑ 12% vs last year</span>
    </div>
  </div>
</div>
`;

    // remove previous injected content if any
    containerRef.current.innerHTML = "";

    // no style injection — global `opex.css` provides styles

    // inject content
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    containerRef.current.appendChild(wrapper);

    // load Chart.js then inject the inline script
    const chartScript = document.createElement("script");
    chartScript.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    chartScript.async = true;
    chartScript.onload = () => {
      // inline script from original page — kept minimal to initialize charts used here
      try {
        // Expiry chart
        // @ts-ignore
        const Chart = (window as any).Chart;
        if (document.getElementById("expiryChart")) {
          new Chart(document.getElementById('expiryChart') as HTMLCanvasElement,{
            type:'bar',
            data:{labels:['< 30 days','< 60 days','< 90 days','> 90 days'],datasets:[{data:[7,14,21,126],backgroundColor:['#B91C1C','#92400E','#78600A','#1A6B3C'],borderRadius:4,borderSkipped:false,barPercentage:0.6,categoryPercentage:0.7}]},
            options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true}}}
          });
        }

        // Anomaly chart minimal renderer (simplified)
        const PRODUCTS = [
          {name:'Ashwagandha',color:'#185FA5',data:[820,950,880,1820,900,970],unit:'g',note:'Feb usage (1,820g) was 2× the avg (902g). Possible bulk dispensing or data entry error — verify with Pharmacy.'},
          {name:'Brahmi Tail',color:'#1A6B3C',data:[320,290,350,410,700,360],unit:'ml',note:'Mar usage (700ml) was 1.8× the avg (405ml). Spike may be linked to Panchakarma season — confirm with department.'},
          {name:'Triphala',color:'#92400E',data:[210,240,190,260,220,250],unit:'g',note:null},
          {name:'Neem Tail',color:'#78600A',data:[140,160,120,180,150,130],unit:'ml',note:null},
          {name:'Haritaki',color:'#3d5a6c',data:[95,110,80,130,340,90],unit:'g',note:'Mar usage (340g) was 2.6× the avg (141g). Unexpectedly high — check if stock was bulk issued or misrecorded.'}
        ];

        function avg(arr:any[]){return Math.round(arr.reduce((a:number,b:number)=>a+b,0)/arr.length)}
        function isAnomaly(v:number,a:number){return v>a*1.5}

        const tabsEl = containerRef.current!.querySelector('#productTabs');
        if (tabsEl) {
          PRODUCTS.forEach((p,i)=>{
            const t = document.createElement('div');
            t.className = 'ptab' + (i===0?' active':'');
            t.textContent = p.name;
            if(i===0){t.style.background = p.color; t.style.color = '#fff'}
            t.onclick = () => {
              containerRef.current!.querySelectorAll('.ptab').forEach(x=>{x.classList.remove('active'); (x as HTMLElement).style.background='transparent'; (x as HTMLElement).style.color='var(--text-dim)'});
              t.classList.add('active'); t.style.background = p.color; t.style.color = '#fff';
              renderAnomalyChart(p);
            };
            tabsEl.appendChild(t);
          });
        }

        function renderAnomalyChart(p:any){
          const a = avg(p.data);
          const noteEl = containerRef.current!.querySelector('#anomalyNote') as HTMLElement;
          if (p.note) {
            noteEl.style.display='block'; noteEl.style.background='#fef9ec'; noteEl.innerHTML = `<strong>⚠ Anomaly detected:</strong> ${p.note}`;
          } else {
            noteEl.style.display='block'; noteEl.style.background='#e6f2eb'; noteEl.innerHTML = `<strong>✓ No anomalies</strong> — consumption within normal range all 6 months.`;
          }
          const footLeft = containerRef.current!.querySelector('#footLeft')!;
          const footRight = containerRef.current!.querySelector('#footRight')!;
          footLeft.innerHTML = `6-month avg &nbsp;<strong>${a} ${p.unit}/month</strong>`;
          footRight.innerHTML = p.note ? `<span style="color:var(--red)">⚠ Spike detected — action needed</span>` : `<span style="color:var(--green)">✓ Normal consumption pattern</span>`;

          const ctx = containerRef.current!.querySelector('#anomalyChart') as HTMLCanvasElement;
          if (!ctx) return;
          // destroy existing chart if any
          // @ts-ignore
          if ((ctx as any)._chart) { try { (ctx as any)._chart.destroy(); } catch(e){} }
          // @ts-ignore
          const chart = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['Nov','Dec','Jan','Feb','Mar','Apr'], datasets: [{ label: 'Monthly usage', data: p.data, backgroundColor: p.data.map((v:number)=>isAnomaly(v,a)?'rgba(185,28,28,0.7)':`${p.color}99`), borderColor: p.data.map((v:number)=>isAnomaly(v,a)?'#B91C1C':p.color), borderWidth:1.5 } ] },
            options: { responsive:true, maintainAspectRatio:false }
          });
          // @ts-ignore
          (ctx as any)._chart = chart;
        }

        renderAnomalyChart(PRODUCTS[0]);

      } catch (e) {
        // swallow errors to avoid breaking page
      }
    };
    document.body.appendChild(chartScript);

    return () => {
      // cleanup injected nodes
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  return <div ref={containerRef} />;
}
