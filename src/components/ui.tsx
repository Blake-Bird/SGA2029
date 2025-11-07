// src/components/ui.tsx
// One-file premium UI kit for HPU Class of 2029 SGA.
// LiquidHeader, KpiMeter, OrbitDeck, CinemaRail, WaterlineStrip,
// LedgerTable (virtualized), RowContextPanel, Kanban, BudgetImpactMeter,
// ExportMenu, Modal, LockGate — all accessible, animated, and polished.

"use client";

import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import { Core } from "@/lib/core";
import type { TeamMember, Transaction, BillStatus, Bill, CSVColumn } from "@/lib/core";
import { Effects } from "@/lib/effects";


/* =======================================================================================
 * Small Hooks
 * ======================================================================================= */

function useIsomorphicLayoutEffect(effect: React.EffectCallback, deps: React.DependencyList) {
  const isBrowser = typeof window !== "undefined";
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return isBrowser ? useLayoutEffect(effect, deps) : useEffect(effect, deps);
}

function useInView<T extends Element>(opts?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => setInView(!!e?.isIntersecting), {
      threshold: 0.15,
      ...opts,
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [opts]);
  return { ref, inView };
}

function useOnKey(handler: (e: KeyboardEvent) => void, deps: React.DependencyList = []) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => handler(e);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* =======================================================================================
 * 1) LiquidHeader — crest + nav + opacity-on-scroll
 * ======================================================================================= */

export function LiquidHeader() {
  const [opaque, setOpaque] = useState(false);
  useEffect(() => {
    const onScroll = () => setOpaque(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className="site-header" aria-label="Header">
      <div className="inner" style={{ transition: "opacity var(--dur-fast) var(--ease-soft)" }}>
        <div className="brand" style={{ opacity: opaque ? 1 : 0.96 }}>
          <img src="/img/crest.svg" alt="HPU Crest" width={28} height={28} />
          <span>HPU 2029 SGA</span>
        </div>
        <nav className="nav" aria-label="Primary">
          <a href="/" aria-current={isActive("/")}>Home</a>
          <a href="/events" aria-current={isActive("/events")}>Events</a>
          <a href="/ledger" aria-current={isActive("/ledger")}>Ledger</a>
          <a href="/bills" aria-current={isActive("/bills")}>Bills</a>
          <a href="/team" aria-current={isActive("/team")}>Team</a>
          <a href="/admin" aria-current={isActive("/admin")}>Admin</a>
        </nav>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          {Core.isInvited() ? (
            <button className="btn ghost" onClick={() => { Core.signOut(); location.reload(); }}>
              Sign out
            </button>
          ) : (
            <a className="btn gold" href="#sign-in">Sign in</a>
          )}
        </div>
      </div>
    </header>
  );
}

function isActive(path: string) {
  if (typeof window === "undefined") return undefined;
  return window.location.pathname === path ? "page" : undefined;
}

/* =======================================================================================
 * 2) KpiMeter — Count-up-on-view, luxe numerals
 * ======================================================================================= */

export function KpiMeter(props: { label: string; value: number; formatter?: (n: number)=>string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const spanRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!spanRef.current) return;
    if (!inView) return;
    return Effects.countUp(spanRef.current, props.value, 900, props.formatter ?? defaultMoney);
  }, [inView, props.value, props.formatter]);
  return (
    <div ref={ref} className="card kpi" style={{ padding: 18 }}>
      <div className="caption" aria-hidden="true" style={{ marginBottom: 8 }}>
        {props.label}
      </div>
      <div data-numeric aria-live="polite" aria-label={`${props.label} ${formatAria(props.value)}`} style={{ fontSize: 28 }}>
        <span ref={spanRef}>{(props.formatter ?? defaultMoney)(0)}</span>
      </div>
    </div>
  );
}

function defaultMoney(n: number) { return Core.formatMoney(Math.round(n)); }
function formatAria(v: number) { return Core.formatMoney(v); }

/* =======================================================================================
 * 3) OrbitDeck — 5-card SGA orbit with flip + keyboard a11y
 * ======================================================================================= */

export function OrbitDeck() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<HTMLDivElement[]>([]);
  const [handle, setHandle] = useState<Effects.OrbitHandle | undefined>();
  const [openIndex, setOpen] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const items = cardRefs.current.filter(Boolean);
    const h = Effects.startOrbit(wrap, { items, radius: 240, speed: 0.5 });
    setHandle(h);
    return () => h?.destroy();
  }, []);

  // Keyboard navigation across cards + Enter to flip
  useOnKey((e) => {
    if (!cardRefs.current.length) return;
    const max = cardRefs.current.length - 1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const idx = clamp((openIndex ?? -1) + 1, 0, max);
      cardRefs.current[idx]?.focus();
      setOpen(idx);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const idx = clamp((openIndex ?? 1) - 1, 0, max);
      cardRefs.current[idx]?.focus();
      setOpen(idx);
    }
    if (e.key === "Enter" && openIndex != null) {
      e.preventDefault();
      flipCard(openIndex);
    }
    if (e.key === "Escape") setOpen(null);
  }, [openIndex]);

  function refAt(i: number) {
    return (el: HTMLDivElement | null) => {
      if (!el) return;
      cardRefs.current[i] = el;
    };
  }

  function flipCard(i: number) {
    setOpen(prev => (prev === i ? null : i));
  }

  return (
    <section className="section">
      <div className="container">
        <h2>Meet Your 2029 SGA</h2>
        <div className="orbit card" ref={wrapRef} role="list" aria-label="SGA Officers Orbit">
          <div className="axis" aria-hidden="true" />
          {Core.team.map((m, i) => (
            <OrbitCard
              key={m.id}
              member={m}
              i={i}
              refCb={refAt(i)}
              open={openIndex === i}
              onToggle={() => flipCard(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function OrbitCard(props: {
  member: Core.TeamMember;
  i: number;
  refCb: (el: HTMLDivElement | null) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      ref={props.refCb}
      className="card ripple"
      role="listitem"
      tabIndex={0}
      aria-label={`${props.member.name}, ${props.member.role}`}
      style={{ transformStyle: "preserve-3d" }}
      onClick={props.onToggle}
      onKeyDown={(e) => { if (e.key === "Enter") props.onToggle(); }}
    >
      <div className="card-face front">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <img src={props.member.avatar ?? "/img/gallery-1.jpg"} alt="" width={48} height={48} style={{ borderRadius: 12 }} />
          <div>
            <div style={{ fontWeight: 700 }}>{props.member.name}</div>
            <div className="caption">{props.member.role}</div>
          </div>
        </div>
        <p style={{ marginTop: 12 }}>{props.member.focus ?? "Driving impact across campus."}</p>
      </div>
      <div className="card-face back" aria-hidden={!props.open} style={{ display: props.open ? "block" : "block", pointerEvents: props.open ? "auto" : "none" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>What I’m working on</div>
          <p>{props.member.bio ?? "Building signature experiences."}</p>
          <div className="caption">Office hours: {props.member.officeHours ?? "TBD"}</div>
          <a className="btn ghost" href={`mailto:${props.member.email}`}>Contact</a>
        </div>
      </div>
    </div>
  );
}

/* =======================================================================================
 * 4) CinemaRail — flagship events with portal to detail modal
 * ======================================================================================= */

export function CinemaRail(props: { onOpenEvent: (id: string) => void }) {
  const listRef = useRef<HTMLDivElement | null>(null);

  const onOpen = useCallback((cardEl: HTMLElement, id: string) => {
    const modalRect = rectForModal();
    Effects.playPortal(cardEl, modalRect, { duration: 440, scaleBias: 1.08, fade: true });
    props.onOpenEvent(id);
  }, [props]);

  return (
    <section className="section">
      <div className="container">
        <h2>Flagship Events</h2>
        <div className="cinema" ref={listRef} role="list" aria-label="Flagship events">
          {Core.events.map((ev) => (
            <div
              key={ev.id}
              className="poster ripple"
              role="listitem"
              tabIndex={0}
              aria-label={`${ev.title}, ${Core.yyyyMmDd(ev.date)}`}
              onClick={(e) => onOpen(e.currentTarget as HTMLElement, ev.id)}
              onKeyDown={(e) => { if (e.key === "Enter") onOpen(e.currentTarget as HTMLElement, ev.id); }}
              style={{
                background: `url(${ev.poster ?? "/img/gallery-2.jpg"}) center/cover no-repeat`,
              }}
            >
              <div className="badge">{Core.yyyyMmDd(ev.date)}</div>
              <div className="badge" style={{ right: 14, left: "auto" }}>
                {ev.committee}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function rectForModal(): DOMRect {
  // Approximate center modal rect; used as FLIP target
  const vw = Math.max(360, Math.min(980, window.innerWidth * 0.92));
  const vh = Math.min(680, window.innerHeight * 0.86);
  const left = (window.innerWidth - vw) / 2;
  const top = (window.innerHeight - vh) / 2;
  return new DOMRect(left, top, vw, vh);
}

/* =======================================================================================
 * 5) WaterlineStrip — wraps effects.waterline
 * ======================================================================================= */

export function WaterlineStrip(props: { onRef?: (h?: Effects.WaterlineHandle)=>void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const h = Effects.initWaterline(ref.current);
    props.onRef?.(h);
    return () => h?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="waterline">
      <canvas ref={ref} aria-hidden="true" />
    </div>
  );
}

/* =======================================================================================
 * 6) LedgerTable — virtualized table with sticky cols and context drawer
 * ======================================================================================= */

export function LedgerTable(props: {
  rows: Core.Transaction[];
  onRowSelect?: (row: Core.Transaction | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const rowH = 56;
  const viewportH = 480;
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => setScrollTop((e.target as HTMLDivElement).scrollTop);

  const total = props.rows.length;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - 6);
  const end = Math.min(total, Math.ceil((scrollTop + viewportH) / rowH) + 6);
  const topPad = start * rowH;
  const bottomPad = (total - end) * rowH;

  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"120px 120px 140px 1fr 1fr", padding:"0 6px 8px 6px" }}>
        <div className="caption">Date</div>
        <div className="caption">Type</div>
        <div className="caption">Amount</div>
        <div className="caption">Vendor / Event</div>
        <div className="caption">Memo</div>
      </div>

      <div className="ledger-wrap" ref={wrapRef} onScroll={onScroll} style={{ maxHeight: viewportH, contain:"content" }}>
        <div style={{ height: topPad }} />
        {props.rows.slice(start, end).map((r) => (
          <div
            key={r.id}
            className="ledger-row ripple"
            role="row"
            aria-selected={selected === r.id}
            style={{ height: rowH, marginBottom: 10, borderRadius: 14, overflow: "hidden" }}
            onClick={() => {
              setSelected(r.id);
              props.onRowSelect?.(r);
            }}
          >
            <div className="sticky" style={{ padding: "14px" }}>{Core.yyyyMmDd(r.date)}</div>
            <div style={{ padding: "14px", textTransform:"capitalize" }}>{r.type}</div>
            <div style={{ padding: "14px" }} className={`amt ${r.amountCents<0?"neg":"pos"}`}>
              {Core.formatMoney(r.amountCents)}
            </div>
            <div style={{ padding: "14px" }}>{r.vendor ?? r.eventId ?? "—"}</div>
            <div style={{ padding: "14px" }}>{r.memo ?? "—"}</div>
          </div>
        ))}
        <div style={{ height: bottomPad }} />
      </div>
    </div>
  );
}

/* =======================================================================================
 * 7) RowContextPanel — timeline, attachments, linkouts
 * ======================================================================================= */

export function RowContextPanel(props: { row?: Core.Transaction | null; onClose?: ()=>void }) {
  const r = props.row;
  if (!r) return null;
  const bill = r.billId ? Core.bills.find(b => b.id === r.billId) : undefined;
  const ev = r.eventId ? Core.events.find(e => e.id === r.eventId) : undefined;
  return (
    <aside className="card" aria-label="Transaction details" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent:"space-between", alignItems:"center" }}>
        <h3 style={{ marginBottom: 0 }}>Details</h3>
        <button className="btn ghost" onClick={props.onClose}>Close</button>
      </div>
      <div className="caption" style={{ marginTop: 6 }}>{Core.yyyyMmDd(r.date)} · {r.type}</div>
      <div data-numeric style={{ fontSize: 24, marginTop: 6 }}>{Core.formatMoney(r.amountCents)}</div>
      <div style={{ marginTop: 16, display:"grid", gap: 10 }}>
        <div><strong>Vendor</strong>: {r.vendor ?? "—"}</div>
        <div><strong>Memo</strong>: {r.memo ?? "—"}</div>
        {ev && <div><strong>Event</strong>: <a className="btn link" href={`/events/${ev.id}`}>{ev.title}</a></div>}
        {bill && <div><strong>Bill</strong>: <a className="btn link" href={`/bills/${bill.id}`}>{bill.title}</a></div>}
        {r.link && <div><strong>Attachment</strong>: <a className="btn link" href={r.link}>View</a></div>}
      </div>
    </aside>
  );
}

/* =======================================================================================
 * 8) Kanban — Bills columns with card fold
 * ======================================================================================= */

export function Kanban() {
  const groups = useMemo(() => {
    const map = new Map<Core.BillStatus, Core.Bill[]>();
    (["Draft","Submitted","Approved","Denied","Revised"] as Core.BillStatus[]).forEach(s => map.set(s, []));
    Core.bills.forEach(b => map.get(b.status)?.push(b));
    return map;
  }, []);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5, minmax(220px, 1fr))", gap: 16 }}>
      {(["Draft","Submitted","Approved","Denied","Revised"] as Core.BillStatus[]).map((s) => (
        <div key={s} className="card" style={{ padding: 12 }}>
          <div className="caption" style={{ marginBottom: 10 }}>{s}</div>
          <div style={{ display:"grid", gap: 10 }}>
            {(groups.get(s) ?? []).map(b => <BillFoldCard key={b.id} bill={b} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function BillFoldCard({ bill }: { bill: Core.Bill }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [fold, setFold] = useState<ReturnType<typeof Effects.mountFold>>();
  useIsomorphicLayoutEffect(() => {
    if (!rootRef.current) return;
    const h = Effects.mountFold(rootRef.current, { duration: 520 });
    setFold(h);
    return () => h?.destroy?.();
  }, []);
  return (
    <div ref={rootRef} className="card ripple" style={{ padding: 0 }}>
      <div className="card-face front" style={{ padding: 14 }}>
        <div className="caption">{bill.committee}</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>{bill.title}</div>
        <div data-numeric style={{ marginTop: 6 }}>{Core.formatMoney(bill.amountCents)}</div>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => fold?.open()}>Open</button>
      </div>
      <div className="card-face back" style={{ padding: 14 }}>
        <div className="caption">Timeline</div>
        <div style={{ marginTop: 6 }}>
          <div><strong>Submitted</strong>: {Core.yyyyMmDd(bill.submittedAt)}</div>
          {bill.decidedAt && <div><strong>Decided</strong>: {Core.yyyyMmDd(bill.decidedAt)}</div>}
          {bill.justification && <p style={{ marginTop: 8 }}>{bill.justification}</p>}
        </div>
        <div style={{ display:"flex", gap: 10, marginTop: 10 }}>
          <a className="btn gold" href={`/bills/${bill.id}`}>Open bill</a>
          <button className="btn ghost" onClick={() => fold?.close()}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* =======================================================================================
 * 9) BudgetImpactMeter — low/mid/high meter with live value
 * ======================================================================================= */

export function BudgetImpactMeter(props: { amountCents: number; balanceCents: number }) {
  const pct = props.balanceCents <= 0 ? 1 : Math.min(1, Math.abs(props.amountCents) / props.balanceCents);
  const label = pct < 0.12 ? "Low" : pct < 0.28 ? "Medium" : "High";
  const color = label === "Low" ? "var(--accent-good)" : label === "Medium" ? "var(--accent-warn)" : "var(--accent-bad)";
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="caption">Projected balance impact</div>
      <div data-numeric style={{ display:"flex", alignItems:"baseline", gap: 10, marginTop: 8 }}>
        <div style={{ fontSize: 24 }}>{label}</div>
        <div className="caption">{Core.formatMoney(props.amountCents)} of {Core.formatMoney(props.balanceCents)}</div>
      </div>
      <div style={{ height: 12, background:"rgba(255,255,255,.08)", borderRadius: 999, marginTop: 10, position:"relative" }}>
        <div style={{ position:"absolute", left:0, top:0, bottom:0, width: `${pct*100}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

/* =======================================================================================
 * 10) ExportMenu — CSV + print
 * ======================================================================================= */

export function ExportMenu(props: { rows: Core.Transaction[] }) {
  function onCSV() {
    const cols: Core.CSVColumn<Core.Transaction>[] = [
      { key:"date", title:"Date", value: r => Core.yyyyMmDd(r.date) },
      { key:"type", title:"Type", value: r => r.type },
      { key:"amt",  title:"Amount", value: r => Core.formatMoney(r.amountCents) },
      { key:"vendor", title:"Vendor", value: r => r.vendor ?? "" },
      { key:"memo", title:"Memo", value: r => r.memo ?? "" },
      { key:"event", title:"Event", value: r => r.eventId ?? "" },
      { key:"bill", title:"Bill", value: r => r.billId ?? "" },
    ];
    const csv = Core.toCSV(props.rows, cols, ",");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ledger.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div style={{ display:"flex", gap: 10 }}>
      <button className="btn ghost" onClick={onCSV}>Export CSV</button>
      <button className="btn ghost" onClick={() => window.print()}>Print</button>
    </div>
  );
}

/* =======================================================================================
 * 11) Modal — accessible dialog with focus trap + ESC close
 * ======================================================================================= */

export function Modal(props: { open: boolean; onClose: ()=>void; children: React.ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    Effects.lockScroll(props.open);
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  useEffect(() => {
    if (props.open) setTimeout(() => ref.current?.focus(), 0);
  }, [props.open]);

  if (!props.open) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={props.labelledBy}>
      <div className="panel" tabIndex={-1} ref={ref}>
        {props.children}
      </div>
    </div>
  );
}

/* =======================================================================================
 * 12) LockGate — invite-only lock UX
 * ======================================================================================= */

export function LockGate(props: { children: React.ReactNode }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const invited = Core.isInvited();
  if (invited) return <>{props.children}</>;

  return (
    <div className="card" style={{ padding: 20, textAlign: "center" }} id="sign-in">
      <h3>Invite Required</h3>
      <p className="caption">This section is limited to the 2029 SGA core team in this preview.</p>
      <form onSubmit={(e) => {
        e.preventDefault();
        const r = Core.signIn(email);
        if (!r.ok) setMsg(r.reason ?? "Unable to sign in");
        else location.reload();
      }} style={{ display:"grid", gap: 10, justifyItems:"center", marginTop: 10 }}>
        <input
          type="email"
          required
          placeholder="name@highpoint.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            height: 44, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(255,255,255,.04)", color: "var(--on-dark)", width: "min(420px, 90%)"
          }}
        />
        <button className="btn gold" type="submit">Sign in</button>
        {msg && <div className="caption" role="alert" style={{ color:"var(--accent-bad)" }}>{msg}</div>}
      </form>
    </div>
  );
}

/* =======================================================================================
 * 13) HomeHero — convenience composition (optional export)
 * ======================================================================================= */

export function HomeHero(props: { onExploreEvents: ()=>void; onOpenLedger: ()=>void }) {
  const spotRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // spotlight cursor
    const el = spotRef.current;
    if (!el) return;
    const fn = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      el.style.setProperty("--spot-x", x + "%");
      el.style.setProperty("--spot-y", y + "%");
    };
    window.addEventListener("mousemove", fn, { passive: true });
    return () => window.removeEventListener("mousemove", fn);
  }, []);
  return (
    <section className="hero">
      <div className="spotlight" ref={spotRef} aria-hidden="true" />
      <div className="stage">
        <h1>Class of 2029 SGA — Liquid Transparency, Real Impact.</h1>
        <p>Events that bring us together. Budgets you can explore.</p>
        <div style={{ display:"flex", gap: 12, justifyContent:"center", marginTop: 16 }}>
          <button className="btn gold" onClick={props.onExploreEvents}>Explore Events</button>
          <button className="btn ghost" onClick={props.onOpenLedger}>Open the Ledger</button>
        </div>
      </div>
    </section>
  );
}

/* =======================================================================================
 * 14) KPI Row — convenience (snapshot)
 * ======================================================================================= */

export function KpiRow() {
  const k = Core.computeKPIs(Core.transactions, new Date().getFullYear());
  const waterRef = useRef<Effects.WaterlineHandle>();
  return (
    <section className="section" aria-label="Finance snapshot">
      <div className="container">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap: 12 }}>
          <KpiMeter label="Current Balance" value={k.currentBalanceCents} formatter={Core.formatMoney} />
          <KpiMeter label="Inflow (YTD)" value={k.inflowYTD} formatter={Core.formatMoney} />
          <KpiMeter label="Outflow (YTD)" value={k.outflowYTD} formatter={Core.formatMoney} />
        </div>
        <WaterlineStrip onRef={(h) => (waterRef.current = h)} />
        <div style={{ display:"flex", gap: 10 }}>
          {["all","allocation","expense","revenue","transfer"].map(t => (
            <button key={t} className="btn ripple ghost" onClick={() => Effects.pulseWaterlineOnFilter(waterRef.current!)}>
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =======================================================================================
 * Utilities
 * ======================================================================================= */

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
