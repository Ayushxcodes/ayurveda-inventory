"use client";

import { useEffect, useState } from 'react';
import StatStrip from './allitems/StatStrip';
import AttentionCard from './allitems/AttentionCard';
import InventoryHealthPanel from './allitems/InventoryHealthPanel';
import ActivityPanel from './allitems/ActivityPanel';

type DashboardPayload = {
  totalItems: number
  capexCount: number
  opexCount: number
  activeAlerts: number
  grnThisMonth: number
  recentGrns: any[]
  expiring?: { batchId: number; batchNumber?: string; expiryDate?: string; quantityAvailable?: string; item?: { itemId?: number; itemName?: string } }[]
  lowStock?: { itemId: number; itemName?: string; totalAvailable: number }[]
  amcDue?: { amcId: number; amcNumber?: string; contractEnd?: string; item?: { itemId?: number; itemName?: string } }[]
}

export default function AllItemsDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((json) => {
        if (mounted) setData(json)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  return (
    <div className="all-items-root">
      <StatStrip totalItems={data?.totalItems ?? 0} capexCount={data?.capexCount ?? 0} opexCount={data?.opexCount ?? 0} activeAlerts={data?.activeAlerts ?? 0} grnThisMonth={data?.grnThisMonth ?? 0} />
      <AttentionCard activeAlerts={data?.activeAlerts ?? 0} expiring={data?.expiring ?? []} lowStock={data?.lowStock ?? []} amcDue={data?.amcDue ?? []} />

      <div className="bottom-row">
        <InventoryHealthPanel totalItems={data?.totalItems ?? 0} capexCount={data?.capexCount ?? 0} opexCount={data?.opexCount ?? 0} />
        <ActivityPanel recentGrns={data?.recentGrns ?? []} />
      </div>

      {/* styles moved to src/components/allitems/allitemsdashboard.css and imported in globals.css */}
    </div>
  )
}
