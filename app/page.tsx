"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "BREAKOUT" | "RISING" | "EARLY" | "COOLING" | "FADING" | "UNVERIFIED";
type Tab = "Dashboard" | "Breakouts" | "Rising" | "Early" | "Cooling" | "Fading" | "Discovery" | "Watchlist" | "Alerts" | "Reports";

type Trend = {
  id: string;
  name: string;
  category?: string | null;
  source?: string | null;
  score?: number | null;
  velocity?: number | null;
  acceleration?: number | null;
  spread?: number | null;
  adoption?: number | null;
  longevity?: number | null;
  status?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  events?: number | null;
  publishers?: number | null;
  evidence?: number | null;
  meme?: number | null;
  model: {
    model_version: string;
    hype_score: number;
    confidence: number;
    status: Status;
    momentum: number;
    reasons: string[];
    verified?: boolean;
    evidence_quality?: string;
    raw?: { velocity?: number; acceleration?: number };
  };
};

type ApiData = {
  model_version?: string;
  source?: string;
  configured?: boolean;
  updated_at?: string;
  total?: number;
  verified?: number;
  coverage_percent?: number;
  counts?: Record<string, number>;
  trends?: Trend[];
  error?: string;
};

const tabs: { id: Tab; label: string; status?: Status }[] = [
  { id: "Dashboard", label: "Dashboard" },
  { id: "Breakouts", label: "Breakouts", status: "BREAKOUT" },
  { id: "Rising", label: "Rising", status: "RISING" },
  { id: "Early", label: "Early", status: "EARLY" },
  { id: "Cooling", label: "Cooling", status: "COOLING" },
  { id: "Fading", label: "Fading", status: "FADING" },
  { id: "Discovery", label: "Discovery", status: "UNVERIFIED" },
  { id: "Watchlist", label: "Watchlist" },
  { id: "Alerts", label: "Alerts" },
  { id: "Reports", label: "Reports" },
];

const statusStyle: Record<Status, string> = {
  BREAKOUT: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  RISING: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  EARLY: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  COOLING: "border-yellow-400/20 bg-yellow-400/10 text-yellow-300",
  FADING: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  UNVERIFIED: "border-white/10 bg-white/[.03] text-zinc-500",
};

function Badge({ status }: { status: Status }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[.16em] ${statusStyle[status]}`}>{status}</span>;
}

function Meter({ value }: { value: number }) {
  return <div className="h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

const statusLabel: Record<Status, string> = {
  BREAKOUT: "Breakout",
  RISING: "Rising",
  EARLY: "Early",
  COOLING: "Cooling",
  FADING: "Fading",
  UNVERIFIED: "Discovery",
};

export default function Home() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [trends, setTrends] = useState<Trend[]>([]);
  const [selected, setSelected] = useState<Trend | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("connecting");
  const [coverage, setCoverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [previousIds, setPreviousIds] = useState<string[]>([]);

  useEffect(() => {
    try { setWatchlist(JSON.parse(localStorage.getItem("hv-watchlist") || "[]")); } catch { setWatchlist([]); }
  }, []);

  useEffect(() => {
    localStorage.setItem("hv-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/trends", { cache: "no-store" });
      const data = (await res.json()) as ApiData;
      const next = data.trends ?? [];
      setPreviousIds(trends.map(t => t.id));
      setTrends(next);
      setSource(data.source ?? "unknown");
      setCoverage(data.coverage_percent ?? 0);
      setTotal(data.total ?? next.length);
      setError(data.error ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load signals");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(() => Object.fromEntries(
    (["BREAKOUT", "RISING", "EARLY", "COOLING", "FADING", "UNVERIFIED"] as Status[]).map(s => [s, trends.filter(t => t.model.status === s).length])
  ) as Record<Status, number>, [trends]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trends;
    return trends.filter(t => [t.name, t.category, t.source, t.model.status, ...(t.model.reasons || [])].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [trends, query]);

  const visible = useMemo(() => {
    if (tab === "Dashboard") return searched.slice(0, 24);
    if (tab === "Watchlist") return searched.filter(t => watchlist.includes(t.id));
    if (tab === "Alerts") return searched.filter(t => !previousIds.includes(t.id) || t.model.status === "BREAKOUT").slice(0, 50);
    if (tab === "Reports") return searched.slice(0, 50);
    const status = tabs.find(t => t.id === tab)?.status;
    return status ? searched.filter(t => t.model.status === status) : searched;
  }, [tab, searched, watchlist, previousIds]);

  const top = searched[0];
  const verified = trends.filter(t => t.model.verified).length;
  const avgConfidence = verified ? trends.filter(t => t.model.verified).reduce((a, t) => a + t.model.confidence, 0) / verified : 0;
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    trends.forEach(t => map.set(t.category || "Uncategorized", (map.get(t.category || "Uncategorized") || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [trends]);

  function toggleWatch(id: string) {
    setWatchlist(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  }

  const pageTitle: Record<Tab, string> = {
    Dashboard: "See what's about to move.", Breakouts: "Find the next breakout.", Rising: "Catch what's rising.", Early: "Get there before the crowd.",
    Cooling: "Know what's cooling.", Fading: "Know what's fading.", Discovery: "Find signals before they qualify.", Watchlist: "Your monitored signals.", Alerts: "Fresh signals that need attention.", Reports: "The market in numbers."
  };

  return (
    <main className="min-h-screen bg-[#050506] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[.06] bg-[#050506]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <button onClick={() => setTab("Dashboard")} className="flex items-center gap-3 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-400/10"><span className="h-3 w-3 rounded-full bg-orange-400 shadow-[0_0_18px_rgba(251,146,60,.8)]" /></span>
            <span><b className="block text-sm tracking-[.22em]">HYPEVECTOR</b><small className="block text-[9px] tracking-[.3em] text-zinc-600">TREND INTELLIGENCE</small></span>
          </button>
          <div className="hidden max-w-xl flex-1 md:block"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search trends, categories, sources..." className="w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-2.5 text-sm outline-none placeholder:text-zinc-700 focus:border-orange-400/30" /></div>
          <div className="flex items-center gap-2"><span className="hidden text-[9px] font-black tracking-[.16em] text-emerald-400 sm:block">● {source.toUpperCase()}</span><button onClick={load} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[.05]">↻ Refresh</button></div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-white/[.04] px-4 py-2">
          {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs ${tab === t.id ? "bg-orange-400/10 text-orange-300" : "text-zinc-500 hover:text-white"}`}>{t.label}{t.status ? <span className="ml-1.5 text-[9px] opacity-50">{counts[t.status] ?? 0}</span> : ""}</button>)}
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-20 pt-10 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-3 text-[10px] font-black tracking-[.22em] text-emerald-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> LIVE MODEL
          <span className="text-zinc-700">• V16.5</span><span className="text-zinc-700">• {total} TRENDS</span><span className="text-zinc-700">• {coverage}% EVIDENCE COVERAGE</span>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">{error}</div>}

        <div className="mb-8 max-w-4xl">
          <h1 className="text-5xl font-black leading-[.98] tracking-tight sm:text-7xl">{pageTitle[tab]}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-500">V16.5 ranks momentum, acceleration, spread, adoption and evidence. Unverified trends stay visible in Discovery instead of being mislabeled as fading.</p>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {(["BREAKOUT", "RISING", "EARLY", "COOLING", "FADING", "UNVERIFIED"] as Status[]).map(s => {
            const target = tabs.find(t => t.status === s)?.id || "Dashboard";
            return <button key={s} onClick={() => setTab(target)} className="rounded-2xl border border-white/[.07] bg-white/[.02] p-4 text-left hover:bg-white/[.04]"><Badge status={s}/><div className="mt-3 text-2xl font-black">{counts[s] ?? 0}</div><div className="mt-1 text-[10px] text-zinc-600">{s === "UNVERIFIED" ? "awaiting evidence" : "live signals"}</div></button>;
          })}
        </div>

        {tab === "Reports" && <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/[.07] bg-white/[.02] p-6"><div className="text-[10px] tracking-[.18em] text-zinc-600">VERIFIED COVERAGE</div><div className="mt-3 text-4xl font-black">{coverage}%</div><div className="mt-4"><Meter value={coverage}/></div></div>
          <div className="rounded-3xl border border-white/[.07] bg-white/[.02] p-6"><div className="text-[10px] tracking-[.18em] text-zinc-600">AVG CONFIDENCE</div><div className="mt-3 text-4xl font-black">{avgConfidence.toFixed(0)}%</div></div>
          <div className="rounded-3xl border border-white/[.07] bg-white/[.02] p-6"><div className="text-[10px] tracking-[.18em] text-zinc-600">WATCHLIST</div><div className="mt-3 text-4xl font-black">{watchlist.length}</div></div>
        </div>}

        {tab === "Dashboard" && top && <div className="mb-8 rounded-3xl border border-orange-400/20 bg-orange-400/[.05] p-6 sm:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="mb-3"><Badge status={top.model.status}/></div><h2 className="max-w-3xl text-3xl font-black sm:text-5xl">{top.name}</h2><p className="mt-3 max-w-2xl text-sm text-zinc-500">{top.category || "Trend"} · {top.source || "Unknown source"} · {top.model.reasons.join(" · ")}</p></div>
            <div className="flex items-end gap-6"><div><div className="text-[9px] tracking-[.18em] text-zinc-600">HYPE</div><div className="text-5xl font-black text-orange-300">{top.model.hype_score.toFixed(1)}</div></div><div><div className="text-[9px] tracking-[.18em] text-zinc-600">CONF</div><div className="text-3xl font-black">{top.model.confidence.toFixed(0)}%</div></div></div>
          </div>
        </div>}

        {tab === "Dashboard" && categoryCounts.length > 0 && <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/[.07] bg-white/[.02] p-6"><div className="mb-5 text-[10px] font-black tracking-[.18em] text-zinc-500">TOP CATEGORIES</div>{categoryCounts.map(([name, n]) => <div key={name} className="mb-4"><div className="mb-2 flex justify-between text-xs"><span>{name}</span><span className="text-zinc-600">{n}</span></div><Meter value={(n / Math.max(1, trends.length)) * 100}/></div>)}</div>
          <div className="rounded-3xl border border-white/[.07] bg-white/[.02] p-6"><div className="mb-5 text-[10px] font-black tracking-[.18em] text-zinc-500">MODEL COVERAGE</div><div className="flex items-end justify-between"><div><div className="text-5xl font-black">{verified}</div><div className="text-xs text-zinc-600">verified of {total}</div></div><div className="w-1/2"><Meter value={coverage}/><div className="mt-2 text-right text-[10px] text-zinc-600">{coverage}% evidence coverage</div></div></div><p className="mt-5 text-xs leading-5 text-zinc-600">Unverified signals are intentionally separated from ranked lifecycle states until the evidence collector supplies corroboration.</p></div>
        </div>}

        <div className="mb-4 flex items-center justify-between"><h2 className="text-xs font-black tracking-[.2em] text-zinc-500">{tab === "Dashboard" ? "LIVE SIGNAL BOARD" : tab.toUpperCase()} <span className="ml-2 text-zinc-700">{visible.length}</span></h2>{loading && <span className="text-[10px] text-zinc-700">Updating…</span>}</div>

        {visible.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><div className="text-lg font-bold">No signals here yet.</div><p className="mt-2 text-sm text-zinc-600">Try another tab or search term. HypeVector will not manufacture signals to fill the board.</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t, i) => <button key={t.id} onClick={() => setSelected(t)} className="group rounded-2xl border border-white/[.07] bg-white/[.02] p-5 text-left transition hover:-translate-y-0.5 hover:border-orange-400/20 hover:bg-white/[.04]">
            <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="text-[10px] font-black text-zinc-700">{String(i + 1).padStart(2, "0")}</span><Badge status={t.model.status}/></div><button onClick={(e) => { e.stopPropagation(); toggleWatch(t.id); }} className={`rounded-lg px-2 py-1 text-xs ${watchlist.includes(t.id) ? "bg-orange-400/10 text-orange-300" : "text-zinc-700 hover:text-white"}`}>{watchlist.includes(t.id) ? "★" : "☆"}</button></div>
            <h3 className="mt-4 line-clamp-2 text-lg font-black">{t.name}</h3><div className="mt-1 text-[10px] text-zinc-600">{t.category || "Trend"} · {t.source || "Unknown"}</div>
            <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-black/20 p-3"><span className="block text-[8px] tracking-[.16em] text-zinc-600">HYPE</span><b className="text-orange-300">{t.model.hype_score.toFixed(1)}</b></div><div className="rounded-xl bg-black/20 p-3"><span className="block text-[8px] tracking-[.16em] text-zinc-600">CONFIDENCE</span><b>{t.model.confidence.toFixed(0)}%</b></div></div>
            <div className="mt-4"><div className="mb-2 flex justify-between text-[9px] text-zinc-600"><span>V {Number(t.velocity ?? t.model.raw?.velocity ?? 0).toFixed(0)} · A {Number(t.acceleration ?? t.model.raw?.acceleration ?? 0).toFixed(0)} · S {Number(t.spread ?? 0).toFixed(0)}</span><span>{t.model.evidence_quality || "unknown"}</span></div><Meter value={t.model.hype_score}/></div>
          </button>)}
        </div>}
      </section>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm" onClick={() => setSelected(null)}>
        <div className="w-full max-w-2xl rounded-3xl border border-orange-400/20 bg-[#0b0b0d] p-7" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><Badge status={selected.model.status}/><h2 className="mt-4 text-2xl font-black">{selected.name}</h2><p className="mt-2 text-xs text-zinc-600">{selected.category || "Trend"} · {selected.source || "Unknown source"}</p></div><button onClick={() => setSelected(null)} className="text-zinc-500">✕</button></div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Hype", selected.model.hype_score.toFixed(1)], ["Confidence", `${selected.model.confidence.toFixed(1)}%`], ["Velocity", Number(selected.velocity ?? 0).toFixed(1)], ["Acceleration", Number(selected.acceleration ?? 0).toFixed(1)], ["Spread", Number(selected.spread ?? 0).toFixed(1)], ["Adoption", Number(selected.adoption ?? 0).toFixed(1)], ["Events", String(selected.events ?? 0)], ["Publishers", String(selected.publishers ?? 0)]].map(([k,v]) => <div key={k} className="rounded-xl border border-white/[.06] bg-white/[.02] p-4"><div className="text-[9px] tracking-[.16em] text-zinc-600">{k}</div><div className="mt-2 text-lg font-bold">{v}</div></div>)}</div>
          <div className="mt-5 rounded-xl border border-white/[.06] p-4"><div className="text-[9px] font-bold tracking-[.18em] text-zinc-600">WHY IT IS HERE</div><div className="mt-3 flex flex-wrap gap-2">{selected.model.reasons.map(r => <span key={r} className="rounded-full bg-white/[.04] px-3 py-1 text-[10px] text-zinc-300">{r}</span>)}</div></div>
          <div className="mt-5 flex gap-3"><button onClick={() => toggleWatch(selected.id)} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-black">{watchlist.includes(selected.id) ? "★ Remove from watchlist" : "☆ Add to watchlist"}</button><button onClick={() => setSelected(null)} className="flex-1 rounded-xl bg-white py-3 text-sm font-black text-black">Close</button></div>
        </div>
      </div>}
    </main>
  );
}
