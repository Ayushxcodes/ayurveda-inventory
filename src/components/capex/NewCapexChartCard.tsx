"use client";

import BarChart from '../charts/BarChart';

export default function NewCapexChartCard(){
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">New CAPEX items added — last 6 months</span><a className="view-link">View GRN report →</a></div>
      <div className="card-body">
        <div className="chart-with-summary">
          <div className="chart-col">
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-sq" style={{ background: 'var(--blue)' }}></div>Medical devices</div>
              <div className="legend-item"><div className="legend-sq" style={{ background: 'var(--green)' }}></div>Electrical</div>
            </div>
            <div className="chart-wrap">
              <BarChart />
            </div>
          </div>

          <div className="summary-col">
            <div className="sum-block"><div className="sum-lbl">Total this year</div><div className="sum-num">26</div><div className="sum-sub">↑ 18% vs last year</div></div>
            <div style={{ height: 1, background: 'var(--border)' }}></div>
            <div className="sum-block"><div className="sum-lbl">Peak month</div><div className="sum-num-sm">Feb &nbsp;<span style={{ color: 'var(--green)' }}>6 items</span></div></div>
            <div style={{ height: 1, background: 'var(--border)' }}></div>
            <div className="sum-block"><div className="sum-lbl">Devices added</div><div className="sum-num-sm" style={{ color: 'var(--blue)' }}>16 items</div></div>
            <div style={{ height: 1, background: 'var(--border)' }}></div>
            <div className="sum-block"><div className="sum-lbl">Electrical added</div><div className="sum-num-sm" style={{ color: 'var(--green)' }}>10 items</div></div>
            <div style={{ height: 1, background: 'var(--border)' }}></div>
            <div className="sum-block"><div className="sum-lbl">Monthly average</div><div className="sum-num-sm">4.3 items</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
