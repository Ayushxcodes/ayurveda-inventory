"use client";

export default function KPICards(){
  return (
    <>
      <div className="kpi-card g"><div className="kpi-num green">80</div><div className="kpi-lbl">Total CAPEX items</div><div className="kpi-sub">registered in system</div></div>
      <div className="kpi-card b"><div className="kpi-num blue">48</div><div className="kpi-lbl">Medical devices</div><div className="kpi-sub">BP monitors, thermometers…</div></div>
      <div className="kpi-card r"><div className="kpi-num red">3</div><div className="kpi-lbl">AMC renewals due</div><div className="kpi-sub">within 60 days — action needed</div></div>
    </>
  );
}
