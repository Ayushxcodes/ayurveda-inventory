"use client";

import SectionHead from "./opex/SectionHead";
import DonutKpiCard from "./opex/DonutKpiCard";
import KPICards from "./opex/KPICards";
import ExpiryPipelineCard from "./opex/ExpiryPipelineCard";
import LowStockCard from "./opex/LowStockCard";
import AnomalyTrackerCard from "./opex/AnomalyTrackerCard";
import WastageCard from "./opex/WastageCard";

export default function OpexDashboard() {
  return (
    <>
      <SectionHead badge="OPEX" title="Operating stock — medicines & consumables" sub="Regular purchase · Expiry tracked · Stock replenished" />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', marginBottom: 12 }}>
        <DonutKpiCard total={168} medicines={142} consumables={26} />
        <KPICards />
      </div>

      <div className="grid g-2" style={{ marginBottom: 12 }}>
        <ExpiryPipelineCard />
        <LowStockCard />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 0 }}>
        <AnomalyTrackerCard />
        <WastageCard />
      </div>
    </>
  );
}
