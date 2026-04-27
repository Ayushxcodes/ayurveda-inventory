"use client";

import StatStrip from './allitems/StatStrip';
import AttentionCard from './allitems/AttentionCard';
import InventoryHealthPanel from './allitems/InventoryHealthPanel';
import ActivityPanel from './allitems/ActivityPanel';

export default function AllItemsDashboard() {
  return (
    <div className="all-items-root">
      <StatStrip />
      <AttentionCard />

      <div className="bottom-row">
        <InventoryHealthPanel />
        <ActivityPanel />
      </div>

      {/* styles moved to src/components/allitems/allitemsdashboard.css and imported in globals.css */}
    </div>
  );
}
