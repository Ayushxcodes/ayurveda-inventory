"use client";

import { useState, useEffect, useRef } from "react";
import { Item, FilterState } from "./registry/utils";
import FilterBar from "./registry/FilterBar";
import ResultStrip from "./registry/ResultStrip";
import RegistryTable from "./registry/RegistryTable";
import DetailPanel from "./registry/DetailPanel";

// ─── Data ─────────────────────────────────────────────────────────────────────

const ITEMS: Item[] = [
  // OPEX — Medicines
  { id: "MED-001", name: "Ashwagandha Churna", sub: "Rasayana Churna", category: "OPEX", subcat: "medicines", stock: 5000, min: 1000, max: 15000, unit: "g", expiry: "2026-05-31", dept: "PHM", status: "healthy", batch: "ASH-2024-A1", supplier: "Dabur India Ltd.", price: 85 },
  { id: "MED-002", name: "Triphala Churna", sub: "Digestive Churna", category: "OPEX", subcat: "medicines", stock: 3200, min: 1500, max: 10000, unit: "g", expiry: "2026-01-14", dept: "PHM", status: "healthy", batch: "TRI-2024-B2", supplier: "Baidyanath", price: 60 },
  { id: "MED-003", name: "Brahmi Tail", sub: "Nervine Tail", category: "OPEX", subcat: "medicines", stock: 4500, min: 500, max: 10000, unit: "ml", expiry: "2026-05-09", dept: "PKM", status: "healthy", batch: "BRT-2024-C1", supplier: "Kottakkal AVS", price: 120 },
  { id: "MED-004", name: "Haritaki Churna", sub: "Digestive Churna", category: "OPEX", subcat: "medicines", stock: 1800, min: 800, max: 6000, unit: "g", expiry: "2025-03-19", dept: "PHM", status: "expiring", batch: "HAR-2024-D3", supplier: "Charak Pharma", price: 55 },
  { id: "MED-005", name: "Neem Tail", sub: "External Tail", category: "OPEX", subcat: "medicines", stock: 320, min: 500, max: 5000, unit: "ml", expiry: "2024-12-31", dept: "SHA", status: "expired", batch: "NEM-2024-E1", supplier: "Patanjali Ayurved", price: 90 },
  { id: "MED-006", name: "Chyawanprash", sub: "Rasayana Avaleha", category: "OPEX", subcat: "medicines", stock: 6000, min: 2000, max: 20000, unit: "g", expiry: "2026-01-31", dept: "PHM", status: "healthy", batch: "CHY-2024-F2", supplier: "Dabur India Ltd.", price: 180 },
  { id: "MED-007", name: "Mahanarayan Tail", sub: "Musculoskeletal Tail", category: "OPEX", subcat: "medicines", stock: 3000, min: 500, max: 8000, unit: "ml", expiry: "2026-03-14", dept: "PKM", status: "healthy", batch: "MNT-2024-G1", supplier: "Kottakkal AVS", price: 240 },
  { id: "MED-008", name: "Dashmoolarishta", sub: "Tonic Arishta", category: "OPEX", subcat: "medicines", stock: 8000, min: 1000, max: 15000, unit: "ml", expiry: "2027-03-31", dept: "PHM", status: "healthy", batch: "DSH-2024-H1", supplier: "Vaidyaratnam", price: 95 },
  { id: "MED-010", name: "Guduchi Churna", sub: "Immunomodulator Churna", category: "OPEX", subcat: "medicines", stock: 2500, min: 1000, max: 8000, unit: "g", expiry: "2025-06-30", dept: "KAY", status: "expiring", batch: "GUD-2024-J1", supplier: "Charak Pharma", price: 70 },
  { id: "MED-011", name: "Shatavari Churna", sub: "Gynaecology Churna", category: "OPEX", subcat: "medicines", stock: 3000, min: 1000, max: 8000, unit: "g", expiry: "2026-08-19", dept: "STR", status: "healthy", batch: "SHA-2024-K2", supplier: "Himalaya Drug Co.", price: 80 },
  { id: "MED-015", name: "Chandraprabha Vati", sub: "Urinary Tablet", category: "OPEX", subcat: "medicines", stock: 2000, min: 500, max: 8000, unit: "tab", expiry: "2027-05-14", dept: "KAY", status: "healthy", batch: "CPV-2024-O2", supplier: "Charak Pharma", price: 3 },
  { id: "MED-022", name: "Sitopaladi Churna", sub: "Respiratory Churna", category: "OPEX", subcat: "medicines", stock: 1500, min: 600, max: 5000, unit: "g", expiry: "2025-09-30", dept: "KAY", status: "expiring", batch: "SIT-2024-V1", supplier: "Dabur India Ltd.", price: 52 },
  { id: "MED-027", name: "Shadbindu Tail", sub: "ENT Tail", category: "OPEX", subcat: "medicines", stock: 1000, min: 200, max: 3000, unit: "ml", expiry: "2026-04-14", dept: "SHA", status: "healthy", batch: "SHB-2024-A2", supplier: "Kottakkal AVS", price: 130 },
  { id: "MED-044", name: "Vasarishta", sub: "Respiratory Arishta", category: "OPEX", subcat: "medicines", stock: 4000, min: 800, max: 12000, unit: "ml", expiry: "2027-06-19", dept: "KAY", status: "healthy", batch: "VAS-2024-R1", supplier: "Dabur India Ltd.", price: 78 },
  // OPEX — Consumables
  { id: "CON-001", name: "Cotton Bandage (2 inch)", sub: "Wound Care", category: "OPEX", subcat: "consumables", stock: 210, min: 1000, max: 5000, unit: "Rolls", expiry: null, dept: "PHM", status: "low_stock", batch: "-", supplier: "J&J Medical", price: 18 },
  { id: "CON-003", name: "Surgical Gloves (S)", sub: "PPE", category: "OPEX", subcat: "consumables", stock: 30, min: 200, max: 2000, unit: "Pairs", expiry: "2025-12-31", dept: "PHM", status: "low_stock", batch: "-", supplier: "Ansell Healthcare", price: 32 },
  { id: "CON-004", name: "Surgical Gloves (M)", sub: "PPE", category: "OPEX", subcat: "consumables", stock: 45, min: 200, max: 2000, unit: "Pairs", expiry: "2025-12-31", dept: "PHM", status: "low_stock", batch: "-", supplier: "Ansell Healthcare", price: 32 },
  { id: "CON-007", name: "Sterile Cotton (500g)", sub: "Wound Care", category: "OPEX", subcat: "consumables", stock: 80, min: 200, max: 1000, unit: "Pcs", expiry: null, dept: "PHM", status: "low_stock", batch: "-", supplier: "Romsons", price: 85 },
  { id: "CON-010", name: "Disposable Syringe 2ml", sub: "Injection", category: "OPEX", subcat: "consumables", stock: 800, min: 1000, max: 10000, unit: "Pcs", expiry: "2026-12-31", dept: "LAB", status: "low_stock", batch: "-", supplier: "Dispovan", price: 3 },
  { id: "CON-017", name: "Shirodhara Pot (Droni)", sub: "Panchakarma", category: "OPEX", subcat: "consumables", stock: 5, min: 10, max: 30, unit: "Pcs", expiry: null, dept: "PKM", status: "low_stock", batch: "-", supplier: "Ayurveda Equipments India", price: 850 },
  { id: "CON-018", name: "Basti Kit (Enema set)", sub: "Panchakarma", category: "OPEX", subcat: "consumables", stock: 25, min: 50, max: 200, unit: "Pcs", expiry: "2026-12-31", dept: "PKM", status: "healthy", batch: "-", supplier: "Romsons", price: 180 },
  { id: "CON-025", name: "Surgical Mask (3-ply)", sub: "PPE", category: "OPEX", subcat: "consumables", stock: 800, min: 2000, max: 20000, unit: "Pcs", expiry: "2025-12-31", dept: "ALL", status: "low_stock", batch: "-", supplier: "Dispo Van", price: 2 },
  { id: "CON-030", name: "Glucometer Strip", sub: "Diagnostics", category: "OPEX", subcat: "consumables", stock: 200, min: 300, max: 2000, unit: "Pcs", expiry: "2026-06-30", dept: "LAB", status: "low_stock", batch: "-", supplier: "Accu-Chek", price: 18 },
  // CAPEX — Devices
  { id: "DEV-001", name: "Digital BP Monitor (Adult)", sub: "Diagnostic — Omron HEM-7120", category: "CAPEX", subcat: "devices", stock: 4, min: 2, max: 6, unit: "Pcs", expiry: null, dept: "KAY", status: "healthy", amc: "MedEquip Services", amcExpiry: "2026-03-14", serial: "OM-SN-001", purchase: "2022-03-15", price: 8500 },
  { id: "DEV-007", name: "Pulse Oximeter", sub: "Diagnostic — Nonin Medical 9590", category: "CAPEX", subcat: "devices", stock: 8, min: 4, max: 10, unit: "Pcs", expiry: null, dept: "ALL", status: "amc_due", amc: "HealthTech Services", amcExpiry: "2025-05-14", serial: "NM-SN-005", purchase: "2022-09-15", price: 3200 },
  { id: "DEV-008", name: "Weighing Scale (Patient)", sub: "Diagnostic — Seca 760", category: "CAPEX", subcat: "devices", stock: 5, min: 3, max: 6, unit: "Pcs", expiry: null, dept: "ALL", status: "amc_due", amc: "Precision Scales India", amcExpiry: "2025-03-31", serial: "SC-SN-002", purchase: "2021-04-01", price: 12000 },
  { id: "DEV-009", name: "Infant Weighing Scale", sub: "Diagnostic — Seca 725", category: "CAPEX", subcat: "devices", stock: 2, min: 1, max: 3, unit: "Pcs", expiry: null, dept: "KAU", status: "amc_due", amc: "Precision Scales India", amcExpiry: "2025-11-19", serial: "SC-SN-007", purchase: "2021-11-20", price: 18000 },
  { id: "DEV-011", name: "Ophthalmoscope", sub: "Diagnostic — Heine Beta 200", category: "CAPEX", subcat: "devices", stock: 3, min: 2, max: 4, unit: "Pcs", expiry: null, dept: "SHA", status: "healthy", amc: "Optics India Service", amcExpiry: "2025-06-14", serial: "HE-SN-001", purchase: "2020-06-15", price: 22000 },
  { id: "DEV-017", name: "Nebulizer Machine", sub: "Therapeutic — Omron NE-C28", category: "CAPEX", subcat: "devices", stock: 6, min: 3, max: 8, unit: "Pcs", expiry: null, dept: "KAY", status: "amc_due", amc: "Omron Service Centre", amcExpiry: "2025-05-31", serial: "OM-NB-002", purchase: "2021-06-01", price: 5500 },
  { id: "DEV-018", name: "Shirodhara Stand (Metal)", sub: "Panchakarma Equipment", category: "CAPEX", subcat: "devices", stock: 4, min: 2, max: 6, unit: "Pcs", expiry: null, dept: "PKM", status: "healthy", amc: null, amcExpiry: null, serial: "AEI-SN-001", purchase: "2020-01-15", price: 15000 },
  { id: "DEV-019", name: "Panchakarma Table (Droni)", sub: "Panchakarma Equipment", category: "CAPEX", subcat: "devices", stock: 8, min: 4, max: 10, unit: "Pcs", expiry: null, dept: "PKM", status: "healthy", amc: null, amcExpiry: null, serial: "TCK-SN-005", purchase: "2019-04-01", price: 35000 },
  { id: "DEV-026", name: "Ophthalmoscope (Slit lamp)", sub: "Diagnostic — Topcon SL-D701", category: "CAPEX", subcat: "devices", stock: 1, min: 1, max: 2, unit: "Pcs", expiry: null, dept: "SHA", status: "amc_due", amc: "Topcon India", amcExpiry: "2025-06-14", serial: "TC-SN-001", purchase: "2023-01-15", price: 280000 },
  { id: "DEV-028", name: "Microscope (Binocular)", sub: "Laboratory — Olympus CX23", category: "CAPEX", subcat: "devices", stock: 3, min: 2, max: 4, unit: "Pcs", expiry: null, dept: "LAB", status: "amc_due", amc: "Olympus Service", amcExpiry: "2025-03-31", serial: "OL-SN-003", purchase: "2021-04-01", price: 55000 },
  { id: "DEV-029", name: "Centrifuge Machine", sub: "Laboratory — REMI R-8C", category: "CAPEX", subcat: "devices", stock: 2, min: 1, max: 3, unit: "Pcs", expiry: null, dept: "LAB", status: "amc_due", amc: "REMI Service", amcExpiry: "2024-09-14", serial: "RM-SN-001", purchase: "2020-09-15", price: 32000 },
  // CAPEX — Electrical
  { id: "ELC-001", name: "Ceiling Fan (48 inch)", sub: "Electrical — Havells Stealth Air", category: "CAPEX", subcat: "electrical", stock: 8, min: 4, max: 12, unit: "Pcs", expiry: null, dept: "OPD Block", status: "healthy", amc: null, amcExpiry: null, serial: "HV-CF-001", purchase: "2019-04-01", price: 2800 },
  { id: "ELC-005", name: "Split AC 1.5 Ton", sub: "Air Conditioning — Daikin FTKR50", category: "CAPEX", subcat: "electrical", stock: 2, min: 1, max: 4, unit: "Pcs", expiry: null, dept: "KAY", status: "amc_due", amc: "Cool Air Services", amcExpiry: "2025-06-14", serial: "DK-AC-001", purchase: "2021-06-15", price: 48000 },
  { id: "ELC-007", name: "Split AC 2 Ton", sub: "Air Conditioning — Voltas 185", category: "CAPEX", subcat: "electrical", stock: 4, min: 2, max: 6, unit: "Pcs", expiry: null, dept: "ALL", status: "expired", amc: "Voltas Service", amcExpiry: "2024-11-19", serial: "VT-AC-001", purchase: "2020-11-20", price: 58000 },
  { id: "ELC-009", name: "Water Heater / Geyser (25L)", sub: "Plumbing — Havells Instanio", category: "CAPEX", subcat: "electrical", stock: 4, min: 2, max: 6, unit: "Pcs", expiry: null, dept: "IPD Wards", status: "amc_due", amc: "HeatPro Services", amcExpiry: "2025-04-30", serial: "HV-WH-001", purchase: "2020-01-01", price: 8500 },
  { id: "ELC-011", name: "Water Purifier (RO+UV)", sub: "Plumbing — Kent Grand+", category: "CAPEX", subcat: "electrical", stock: 5, min: 3, max: 8, unit: "Pcs", expiry: null, dept: "ALL", status: "expired", amc: "AquaCare Ltd.", amcExpiry: "2024-05-31", serial: "KT-WP-001", purchase: "2020-06-01", price: 18000 },
  { id: "ELC-013", name: "UPS (2 KVA)", sub: "Power Backup — Luminous", category: "CAPEX", subcat: "electrical", stock: 6, min: 4, max: 8, unit: "Pcs", expiry: null, dept: "ALL", status: "amc_due", amc: "Luminous Service", amcExpiry: "2024-03-31", serial: "LM-UPS-001", purchase: "2020-04-01", price: 22000 },
  { id: "ELC-016", name: "Generator (25 KVA)", sub: "Power Backup — Kirloskar GL-26", category: "CAPEX", subcat: "electrical", stock: 1, min: 1, max: 2, unit: "Pcs", expiry: null, dept: "ALL", status: "expired", amc: "Kirloskar Service", amcExpiry: "2024-05-31", serial: "KL-GN-001", purchase: "2018-06-01", price: 450000 },
  { id: "ELC-022", name: "Autoclave / Sterilizer", sub: "Sterilization — Surgitec SA-100E", category: "CAPEX", subcat: "electrical", stock: 2, min: 1, max: 3, unit: "Pcs", expiry: null, dept: "SHY", status: "amc_due", amc: "Surgitec India", amcExpiry: "2025-03-14", serial: "SG-AC-001", purchase: "2021-03-15", price: 85000 },
  { id: "ELC-023", name: "Medical Refrigerator", sub: "Cold Chain — Blue Star RCIF", category: "CAPEX", subcat: "electrical", stock: 2, min: 1, max: 3, unit: "Pcs", expiry: null, dept: "PHM", status: "amc_due", amc: "Blue Star Service", amcExpiry: "2025-06-19", serial: "BS-RF-001", purchase: "2021-06-20", price: 55000 },
];

// Helpers and panel components have been moved to src/components/registry/*

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AyurVaidyaRegistry() {
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    subcat: null,
    status: null,
    search: "",
    highlight: null,
    bannerMsg: null,
    sortCol: "name",
  });
  const [detailItem, setDetailItem] = useState<Item | null | "new">(null);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  // Styles are loaded from src/components/registry/registry.css (imported in globals.css)

  // Scroll to highlighted row
  useEffect(() => {
    if (filters.highlight && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [filters.highlight]);

  // ── Filter logic ──────────────────────────────────────────────────────────

  const filtered = (() => {
    let items = ITEMS.filter((item) => {
      if (filters.category !== "all" && item.category !== filters.category) return false;
      if (filters.subcat && item.subcat !== filters.subcat) return false;
      if (filters.status) {
        if (filters.status === "expiring" && !["expiring", "critical"].includes(item.status)) return false;
        if (filters.status === "expired"   && item.status !== "expired") return false;
        if (filters.status === "low_stock" && item.status !== "low_stock") return false;
        if (filters.status === "amc_due"   && item.status !== "amc_due") return false;
        if (filters.status === "healthy"   && item.status !== "healthy") return false;
      }
      if (filters.search) {
        const hay = (item.name + item.sub + item.id + item.dept + (item.batch || "")).toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });

    items.sort((a, b) => {
      let va: string | number = a.name, vb: string | number = b.name;
      if (filters.sortCol === "status")  { va = a.status; vb = b.status; }
      else if (filters.sortCol === "expiry") { va = a.expiry || a.amcExpiry || "9999"; vb = b.expiry || b.amcExpiry || "9999"; }
      else if (filters.sortCol === "stock")  { va = a.stock / a.min; vb = b.stock / b.min; }
      else if (filters.sortCol === "dept")   { va = a.dept; vb = b.dept; }
      return va < vb ? -1 : va > vb ? 1 : 0;
    });

    const urgency: Record<string, number> = { expired: 0, amc_due: 1, expiring: 2, low_stock: 3, healthy: 4 };
    items.sort((a, b) => (urgency[a.status] ?? 4) - (urgency[b.status] ?? 4));

    return items;
  })();

  // ── Chip state helpers ────────────────────────────────────────────────────

  const setCategory = (cat: "all" | "OPEX" | "CAPEX") => {
    setFilters((f) => ({
      ...f,
      category: cat,
      subcat: cat === "all" ? null : f.subcat,
      status: cat === "all" ? null : f.status,
    }));
  };

  const setSubcat = (sub: string) => {
    setFilters((f) => {
      const newSub = f.subcat === sub ? null : sub;
      let newCat: "all" | "OPEX" | "CAPEX" = f.category;
      if (newSub === "devices" || newSub === "electrical") newCat = "CAPEX";
      if (newSub === "medicines" || newSub === "consumables") newCat = "OPEX";
      return { ...f, subcat: newSub, category: newCat };
    });
  };

  const setStatus = (st: string) => {
    setFilters((f) => ({ ...f, status: f.status === st ? null : st }));
  };

  const applyDeepLink = (params: Partial<FilterState>) => {
    setFilters({
      category: (params.category as "all" | "OPEX" | "CAPEX") || "all",
      subcat: params.subcat || null,
      status: params.status || null,
      search: "",
      highlight: params.highlight || null,
      bannerMsg: params.bannerMsg || null,
      sortCol: "name",
    });
  };

  const clearAllFilters = () => {
    setFilters({ category: "all", subcat: null, status: null, search: "", highlight: null, bannerMsg: null, sortCol: "name" });
  };

  const chipClass = (base: string, type: string, activeWhen: boolean) =>
    `chip${activeWhen ? ` active ${type}` : ""}`;

  // ── Demo scenarios ────────────────────────────────────────────────────────

  const DEMO_SCENARIOS: Record<string, Partial<FilterState>> = {
    "all-expiry":    { category: "OPEX",  status: "expiring", bannerMsg: "← From Dashboard → Expiring in 30 days" },
    "all-low":       { category: "OPEX",  status: "low_stock", bannerMsg: "← From Dashboard → Low stock items" },
    "all-amc":       { category: "CAPEX", status: "amc_due",  bannerMsg: "← From Dashboard → AMC renewals due" },
    "all-expired":   { status: "expired", bannerMsg: "← From Dashboard → Already expired — dispose now" },
    "capex-devices": { category: "CAPEX", subcat: "devices",  bannerMsg: "← From CAPEX tab → Medical devices (48)" },
    "capex-elec":    { category: "CAPEX", subcat: "electrical", bannerMsg: "← From CAPEX tab → Electrical items (32)" },
    "opex-meds":     { category: "OPEX",  subcat: "medicines", bannerMsg: "← From OPEX tab → Medicines (142)" },
    "opex-cons":     { category: "OPEX",  subcat: "consumables", bannerMsg: "← From OPEX tab → Consumables (26)" },
    "highlight-neem":{ category: "OPEX",  status: "expiring", highlight: "MED-005", bannerMsg: "← From Dashboard → Neem Tail highlighted" },
    "all":           {},
  };

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="av-app">
      {/* Inject Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

      {/* ── Sidebar ────────────────────────────────────────────── */}
     

      {/* ── Main ───────────────────────────────────────────────── */}
      <div className="main">

        {/* Topbar */}
       

        <FilterBar
          filters={filters}
          setFilters={setFilters}
          setCategory={setCategory}
          setSubcat={setSubcat}
          setStatus={setStatus}
          clearAllFilters={clearAllFilters}
        />

        <ResultStrip filters={filters} filteredCount={filtered.length} setFilters={setFilters} />

        <RegistryTable items={filtered} highlight={filters.highlight} onRowClick={(it) => setDetailItem(it)} highlightRef={highlightRef} />
      </div>

      {/* ── Detail Panel ───────────────────────────────────────── */}
      <DetailPanel item={detailItem} onClose={() => setDetailItem(null)} />

      {/* ── Demo toolbar ───────────────────────────────────────── */}
      <div className="demo-bar">
        <span className="demo-bar-label">Simulate dashboard link:</span>
        {[
          ["all-expiry",    "⏰ Expiring"],
          ["all-low",       "📉 Low stock"],
          ["all-amc",       "📋 AMC due"],
          ["all-expired",   "🚫 Expired"],
          ["capex-devices", "🩺 Devices"],
          ["capex-elec",    "💡 Electrical"],
          ["opex-meds",     "🌿 Medicines"],
          ["opex-cons",     "📦 Consumables"],
          ["highlight-neem","🔗 Highlight item"],
          ["all",           "✕ Clear"],
        ].map(([key, label]) => (
          <button key={key} className="demo-btn" onClick={() => applyDeepLink(DEMO_SCENARIOS[key] || {})}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
