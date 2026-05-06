"use client";

import { useState, useEffect, useRef } from "react";
import { Item, FilterState } from "./registry/utils";
import FilterBar from "./registry/FilterBar";
import ResultStrip from "./registry/ResultStrip";
import RegistryTable from "./registry/RegistryTable";
import DetailPanel from "./registry/DetailPanel";

// Data will be provided from the DB via the API route `/api/registry`

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
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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

  // Fetch items from the DB-backed API and map to `Item` shape
  useEffect(() => {
    let mounted = true
    fetch('/api/registry')
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => {
        if (!mounted || !Array.isArray(data)) return
        const mapped: Item[] = data.map((d: any) => {
          const computeStatus = () => {
            if (d.category === 'CAPEX') {
              if (!d.amcExpiry) return 'healthy'
              const days = Math.round((new Date(d.amcExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              if (days < 0) return 'expired'
              if (days < 60) return 'amc_due'
              return 'healthy'
            }
            if (d.expiry) {
              const days = Math.round((new Date(d.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              if (days < 0) return 'expired'
              if (days < 30) return 'expiring'
            }
            if (d.min && d.stock < d.min) return 'low_stock'
            return 'healthy'
          }

          return {
            id: d.id,
            name: d.name,
            sub: d.sub || '',
            category: d.category,
            subcat: d.subcat,
            stock: Number(d.stock || 0),
            min: Number(d.min || 0),
            max: Number(d.max || 0),
            unit: d.unit || '',
            expiry: d.expiry || null,
            dept: d.dept || '',
            status: computeStatus() as any,
            batch: d.batch || undefined,
            supplier: d.supplier || undefined,
            price: Number(d.price || 0),
            amc: d.amc || null,
            amcExpiry: d.amcExpiry || null,
            serial: d.serial || undefined,
            purchase: d.purchase || undefined,
          }
        })
        setItems(mapped)
        setLoading(false)
      })
      .catch(() => {
        // on error keep items empty
        setItems([])
        setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  // ── Filter logic ──────────────────────────────────────────────────────────

  const filtered = (() => {
    let rows = items.filter((item) => {
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

    // Sort according to selected column. When sorting by `status`, group by urgency
    // (expired/amc_due/expiring/low_stock/healthy). For other sorts, apply the
    // selected comparator and keep name as a tie-breaker.
    const urgency: Record<string, number> = { expired: 0, amc_due: 1, expiring: 2, low_stock: 3, healthy: 4 };
    rows.sort((a, b) => {
      if (filters.sortCol === "status") {
        const ua = urgency[a.status] ?? 4;
        const ub = urgency[b.status] ?? 4;
        if (ua !== ub) return ua - ub;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      }

      let va: string | number = a.name, vb: string | number = b.name;
      if (filters.sortCol === "expiry") { va = a.expiry || a.amcExpiry || "9999"; vb = b.expiry || b.amcExpiry || "9999"; }
      else if (filters.sortCol === "stock")  { va = a.stock / Math.max(1, a.min || 1); vb = b.stock / Math.max(1, b.min || 1); }
      else if (filters.sortCol === "dept")   { va = a.dept; vb = b.dept; }

      if (va < vb) return -1;
      if (va > vb) return 1;
      // tie-breaker
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

    return rows;
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
          onExport={() => {
            try {
              const rows = filtered;
              if (!rows || !rows.length) {
                alert('No rows to export');
                return;
              }
              const cols = ['id','name','category','subcat','stock','min','max','unit','dept','status','expiry','price'];
              const esc = (v: any) => {
                if (v === null || v === undefined) return '';
                const s = String(v);
                if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
                return s;
              }
              const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => esc((r as any)[c])).join(','))).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              const name = 'registry-' + new Date().toISOString().slice(0,10) + '.csv';
              a.href = url;
              a.download = name;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            } catch (e) { console.error(e); alert('Export failed') }
          }}
        />

        <ResultStrip filters={filters} filteredCount={filtered.length} setFilters={setFilters} />

        {loading ? (
          <div style={{ padding: 20 }}>
            <div style={{ height: 18, width: 220, background: '#eee', borderRadius: 6, marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 12 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, background: '#fafafa', borderRadius: 8 }}>
                  <div style={{ height: 14, width: 220, background: '#eee', borderRadius: 4 }} />
                  <div style={{ height: 14, width: 80, background: '#eee', borderRadius: 4, marginLeft: 'auto' }} />
                  <div style={{ height: 14, width: 80, background: '#eee', borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <RegistryTable items={filtered} highlight={filters.highlight} onRowClick={(it) => setDetailItem(it)} highlightRef={highlightRef} />
        )}
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
