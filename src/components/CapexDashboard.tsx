"use client";

import SectionHead from './capex/SectionHead';
import DonutCard from './capex/DonutCard';
import KPICards from './capex/KPICards';
import AMCRenewalsCard from './capex/AMCRenewalsCard';
import NewCapexChartCard from './capex/NewCapexChartCard';

export default function CapexDashboard(){
  return (
    <>
      <SectionHead badge="CAPEX" title="Capital assets — devices & electrical" sub="Long-life items · AMC tracked · No expiry" />

      <div className="grid g-3" style={{ marginBottom: 12 }}>
        <KPICards />
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 12 }}>
        <DonutCard />
        <AMCRenewalsCard />
      </div>

      <NewCapexChartCard />
    </>
  );
}
