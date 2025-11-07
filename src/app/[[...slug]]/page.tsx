// src/app/[[...slug]]/page.tsx
// One-page powerhouse that renders EVERY route with premium UX/motion.
// Routes: /, /events, /events/:id, /ledger, /bills, /bills/:id, /proposals, /team, /admin
// Features: Hero portals, OrbitDeck, CinemaRail + modal, Finance Snapshot (Waterline),
// Social Pulse masonry + media modal, Get-Involved Dock (liquid magnet),
// Events list + detail portal, Ledger (virtualized) + context panel + CSV/print,
// Bills Kanban + 3D Fold, Proposals wizard + BudgetImpactMeter, Team grid, Admin cards,
// Invite-gate wrappers for restricted areas, reduced-motion parity.

"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Core } from "@/lib/core";
import type { ParsedRoute, TxnFilter, TxnSortKey, Transaction } from "@/lib/core";
import { Effects } from "@/lib/effects";
import {
  LiquidHeader, // (already rendered in layout but useful for storybook-style)
  HomeHero,
  OrbitDeck,
  CinemaRail,
  WaterlineStrip,
  KpiRow,
  LedgerTable,
  RowContextPanel,
  Kanban,
  BudgetImpactMeter,
  ExportMenu,
  Modal,
  LockGate,
} from "@/components/ui";

/* =======================================================================================
 * Utilities & Page Routing
 * ======================================================================================= */

function useRoute() {
  const [route, setRoute] = useState<Core.ParsedRoute>(() =>
    Core.routeOf(typeof window !== "undefined" ? window.location.pathname : "/")
  );
  useEffect(() => {
    const onPop = () => setRoute(Core.routeOf(window.location.pathname));
    window.addEventListener("popstate", onPop);
    const originalPush = history.pushState;
    history.pushState = new Proxy(originalPush, {
      apply(target, thisArg, argArray) {
        const ret = Reflect.apply(target, thisArg, argArray);
        onPop();
        return ret;
      },
    }) as typeof history.pushState;
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);
  return [route, setRoute] as const;
}

function navigateTo(r: Core.ParsedRoute) {
  const href = Core.hrefFor(r);
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;
  history.pushState({}, "", href);
}

/* =======================================================================================
 * Root Page: switches on route
 * ======================================================================================= */

export default function Page() {
  const [route] = useRoute();

  // Shared modals (event detail, social media)
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [mediaModal, setMediaModal] = useState<null | { url: string; alt?: string }>(null);

  // Provide section-level handlers so Hero & CinemaRail can open modals/portals
  const handleOpenEvent = (id: string) => {
    setOpenEventId(id);
  };

  return (
    <>
      {/* (Header is rendered by layout) */}
      <main>
        {route.kind === "home" && (
          <HomeSection
            onExploreEvents={() => portalToSelector(".events-section")}
            onOpenLedger={() => portalToSelector(".ledger-section")}
            onOpenEvent={handleOpenEvent}
            onOpenMedia={(m) => setMediaModal(m)}
          />
        )}

        {route.kind === "events" && (
          <EventsSection
            onOpenEvent={(id, cardEl) => {
              Effects.playPortal(cardEl, rectForCenteredModal(), { duration: 460, fade: true, scaleBias: 1.08 });
              setOpenEventId(id);
            }}
          />
        )}

        {route.kind === "eventDetail" && (
          <EventsSection
            initialFocusId={route.id}
            onOpenEvent={(id, _el) => setOpenEventId(id)}
          />
        )}

        {route.kind === "ledger" && <LedgerSection />}

        {route.kind === "bills" && <BillsSection />}

        {route.kind === "billDetail" && <BillsSection focusId={route.id} />}

        {route.kind === "proposals" && <ProposalsSection />}

        {route.kind === "team" && <TeamSection />}

        {route.kind === "admin" && <AdminSection />}

        {/* Event detail modal shared across routes */}
        <EventDetailModal
          id={openEventId}
          onClose={() => setOpenEventId(null)}
        />

        {/* Social media modal */}
        <Modal open={!!mediaModal} onClose={() => setMediaModal(null)} labelledBy="social-media-modal">
          <div style={{ padding: 16 }}>
            <h3 id="social-media-modal" style={{ marginTop: 0 }}>Media</h3>
            {mediaModal?.url?.match(/\.(mp4|webm)$/i) ? (
              <video src={mediaModal.url} controls style={{ width: "100%", borderRadius: 12 }} />
            ) : (
              <img src={mediaModal?.url} alt={mediaModal?.alt ?? "Media"} style={{ width: "100%", borderRadius: 12 }} />
            )}
          </div>
        </Modal>
      </main>
    </>
  );
}

/* =======================================================================================
 * HOME SECTION — Hero, Orbit, Cinema, Finance snapshot, Social Pulse, Dock
 * ======================================================================================= */

function HomeSection(props: {
  onExploreEvents: () => void;
  onOpenLedger: () => void;
  onOpenEvent: (id: string) => void;
  onOpenMedia: (m: { url: string; alt?: string }) => void;
}) {
  const heroRef = useRef<HTMLDivElement | null>(null);

  const onExplore = () => {
    // Portal hero into events rail
    const from = heroRef.current?.querySelector(".stage") as HTMLElement | null;
    if (from) Effects.playPortal(from, rectForRail(), { duration: 420, scaleBias: 1.06, fade: true });
    setTimeout(() => {
      navigateTo({ kind: "events" });
      props.onExploreEvents();
    }, 340);
  };

  const onLedger = () => {
    const from = heroRef.current?.querySelector(".stage") as HTMLElement | null;
    if (from) Effects.playPortal(from, rectForLedgerHeader(), { duration: 420, scaleBias: 1.06 });
    setTimeout(() => {
      navigateTo({ kind: "ledger" });
      props.onOpenLedger();
    }, 320);
  };

  return (
    <>
      <section className="hero" ref={heroRef}>
        <div className="spotlight" aria-hidden="true" />
        <div className="stage">
          <HomeHero onExploreEvents={onExplore} onOpenLedger={onLedger} />
        </div>
      </section>

      {/* Orbit of officers */}
      <section className="section">
        <div className="container">
          <OrbitDeck />
        </div>
      </section>

      {/* Flagship events rail with portals to modal */}
      <CinemaRail onOpenEvent={(id) => props.onOpenEvent(id)} />

      {/* Finance Snapshot (KPI + Waterline + pills) */}
      <KpiRow />

      {/* Social Pulse (Masonry grid; interactive) */}
      <SocialPulse onOpenMedia={props.onOpenMedia} />

      {/* Get Involved Dock (liquid magnet) */}
      <GetInvolvedDock />
    </>
  );
}

/* =======================================================================================
 * EVENTS SECTION — grid + detail modal (portal from card)
 * ======================================================================================= */

function EventsSection(props: {
  onOpenEvent: (id: string, cardEl: HTMLElement) => void;
  initialFocusId?: string;
}) {
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState<"all" | "upcoming" | "past">("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    return Core.events.filter((e) => {
      if (when === "upcoming" && new Date(e.date) < now) return false;
      if (when === "past" && new Date(e.date) >= now) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.summary?.toLowerCase().includes(q) ||
        e.committee.toLowerCase().includes(q)
      );
    });
  }, [query, when]);

  // Auto-open initial focus
  const [initialOpened, setInitialOpened] = useState(false);
  useEffect(() => {
    if (!initialOpened && props.initialFocusId) {
      setInitialOpened(true);
      // just open the modal; portal not necessary on direct route
      const el = document.querySelector(`[data-ev="${props.initialFocusId}"]`) as HTMLElement | null;
      if (el) props.onOpenEvent(props.initialFocusId, el);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialFocusId]);

  return (
    <section className="section events-section">
      <div className="container">
        <h2>Events</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <input
            placeholder="Search events…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              height: 44,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.04)",
              color: "var(--on-dark)",
              width: 300,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            {(["all", "upcoming", "past"] as const).map((k) => (
              <button
                key={k}
                className={`btn ${when === k ? "gold" : "ghost"}`}
                onClick={() => setWhen(k)}
              >
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 && (
          <div className="card" style={{ padding: 16 }}>
            <div className="caption">No events match your filters.</div>
          </div>
        )}
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          }}
        >
          {filtered.map((ev) => (
            <div
              key={ev.id}
              data-ev={ev.id}
              className="card ripple"
              style={{ overflow: "hidden", cursor: "pointer" }}
              onClick={(e) => props.onOpenEvent(ev.id, e.currentTarget as HTMLElement)}
              onKeyDown={(e) => e.key === "Enter" && props.onOpenEvent(ev.id, e.currentTarget as HTMLElement)}
              tabIndex={0}
              role="button"
              aria-label={`${ev.title}, ${Core.yyyyMmDd(ev.date)}`}
            >
              <div
                style={{
                  height: 160,
                  background: `url(${ev.poster ?? "/img/gallery-2.jpg"}) center/cover no-repeat`,
                }}
              />
              <div style={{ padding: 14, display: "grid", gap: 6 }}>
                <div className="caption">{Core.yyyyMmDd(ev.date)} · {ev.location}</div>
                <div style={{ fontWeight: 700 }}>{ev.title}</div>
                <div className="caption">{ev.committee}</div>
                <p style={{ margin: 0, opacity: 0.9 }}>{ev.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =======================================================================================
 * EVENT DETAIL MODAL
 * ======================================================================================= */

function EventDetailModal(props: { id: string | null; onClose: () => void }) {
  const ev = props.id ? Core.events.find((e) => e.id === props.id) : null;
  return (
    <Modal open={!!ev} onClose={props.onClose} labelledBy="event-detail-title">
      {ev && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, padding: 18 }}>
          <h3 id="event-detail-title" style={{ margin: 0 }}>
            {ev.title}
          </h3>
          <div className="caption">
            {Core.yyyyMmDd(ev.date)} · {ev.location} · {ev.committee}
          </div>
          <div
            style={{
              height: 260,
              borderRadius: 14,
              background: `url(${ev.poster ?? "/img/gallery-1.jpg"}) center/cover no-repeat`,
            }}
          />
          <p>{ev.summary}</p>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              <div><div className="caption">Type</div><div>{ev.type}</div></div>
              <div><div className="caption">Est. Budget</div><div data-numeric>{ev.estimateCents ? Core.formatMoney(ev.estimateCents) : "TBD"}</div></div>
              <div><div className="caption">ID</div><div>{ev.id}</div></div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn ghost" onClick={props.onClose}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* =======================================================================================
 * LEDGER SECTION — virtualized table + context panel + export
 * ======================================================================================= */

function LedgerSection() {
  const [filter, setFilter] = useState<Core.TxnFilter>({ type: "all" });
  const [sort, setSort] = useState<Core.TxnSortKey>("date_desc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const q = useMemo(() => Core.queryTransactions({ filter, sort, page, pageSize }), [filter, sort, page]);
  const [selected, setSelected] = useState<Core.Transaction | null>(null);

  const waterRef = useRef<Effects.WaterlineHandle>();
  const explain = Core.explainTransactionsView(filter, sort);

  return (
    <LockGate>
      <section className="section ledger-section">
        <div className="container">
          <h2>Ledger</h2>
          {/* Controls */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
            <input
              placeholder="Find by vendor, memo, amount…"
              onChange={(e) => {
                setPage(1);
                setFilter((f) => ({ ...f, search: e.target.value }));
              }}
              style={{
                height: 44,
                padding: "0 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.14)",
                background: "rgba(255,255,255,.04)",
                color: "var(--on-dark)",
                width: 320,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              {(["all", "allocation", "expense", "revenue", "transfer"] as const).map((t) => (
                <button
                  key={t}
                  className={`btn ${filter.type === t ? "gold" : "ghost"} ripple`}
                  onClick={() => {
                    setPage(1);
                    setFilter((f) => ({ ...f, type: t }));
                    Effects.pulseWaterlineOnFilter(waterRef.current);
                  }}
                >
                  {t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Core.TxnSortKey)}
              style={{
                height: 44,
                padding: "0 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.14)",
                background: "rgba(255,255,255,.04)",
                color: "var(--on-dark)",
              }}
            >
              <option value="date_desc">Most recent</option>
              <option value="date_asc">Oldest</option>
              <option value="amount_desc">Highest amount</option>
              <option value="amount_asc">Lowest amount</option>
            </select>
            <button className="btn ghost" onClick={() => alert(explain)}>Explain this view</button>
            <ExportMenu rows={q.rows} />
          </div>

          {/* KPIs + waterline */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {(() => {
              const k = Core.computeKPIs(Core.transactions, new Date().getFullYear());
              return (
                <>
                  <KpiBox label="Current Balance" value={k.currentBalanceCents} />
                  <KpiBox label="Inflow (YTD)" value={k.inflowYTD} />
                  <KpiBox label="Outflow (YTD)" value={k.outflowYTD} />
                </>
              );
            })()}
          </div>
          <WaterlineStrip onRef={(h) => (waterRef.current = h)} />

          {/* Table + Context */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems:"start" }}>
            <LedgerTable rows={q.rows} onRowSelect={setSelected} />
            <RowContextPanel row={selected} onClose={() => setSelected(null)} />
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <div className="caption">Page {q.page} / {q.pages}</div>
            <button className="btn ghost" disabled={page >= q.pages} onClick={() => setPage((p) => Math.min(q.pages, p + 1))}>
              Next
            </button>
          </div>
        </div>
      </section>
    </LockGate>
  );
}

function KpiBox(props: { label: string; value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    return Effects.countUp(ref.current, props.value, 900, (n) => Core.formatMoney(n));
  }, [props.value]);
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="caption">{props.label}</div>
      <div data-numeric style={{ fontSize: 24, marginTop: 6 }}>
        <span ref={ref}>{Core.formatMoney(0)}</span>
      </div>
    </div>
  );
}

/* =======================================================================================
 * BILLS SECTION — Kanban + fold cards
 * ======================================================================================= */

function BillsSection(props: { focusId?: string }) {
  // If you want to auto-open a particular bill in the future, can route here.
  return (
    <LockGate>
      <section className="section">
        <div className="container">
          <h2>Bills</h2>
          <Kanban />
        </div>
      </section>
    </LockGate>
  );
}

/* =======================================================================================
 * PROPOSALS SECTION — wizard + BudgetImpactMeter
 * ======================================================================================= */

function ProposalsSection() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState(0);
  const [risk, setRisk] = useState("");
  const [impact, setImpact] = useState("");
  const balance = Core.computeKPIs(Core.transactions).currentBalanceCents;

  return (
    <LockGate>
      <section className="section">
        <div className="container">
          <h2>Propose a Future Event</h2>
          <div className="card" style={{ padding: 16 }}>
            {step === 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="caption">Basic</div>
                <input
                  placeholder="Event title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.14)",
                    background: "rgba(255,255,255,.04)",
                    color: "var(--on-dark)",
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn gold" onClick={() => setStep(1)}>Next</button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="caption">Costs</div>
                <input
                  type="number"
                  placeholder="Estimated cost (USD)"
                  value={Math.round(cost / 100)}
                  onChange={(e) => setCost(Core.cents(Number(e.target.value)))}
                  style={{
                    height: 44,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.14)",
                    background: "rgba(255,255,255,.04)",
                    color: "var(--on-dark)",
                  }}
                />
                <BudgetImpactMeter amountCents={cost} balanceCents={balance} />
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                  <button className="btn ghost" onClick={() => setStep(0)}>Back</button>
                  <button className="btn gold" onClick={() => setStep(2)}>Next</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="caption">Risks & Mitigation</div>
                <textarea
                  placeholder="What could go wrong, and how will you mitigate it?"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  rows={5}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.14)",
                    background: "rgba(255,255,255,.04)",
                    color: "var(--on-dark)",
                  }}
                />
                <div className="caption">Impact</div>
                <textarea
                  placeholder="Why it matters for students"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  rows={4}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.14)",
                    background: "rgba(255,255,255,.04)",
                    color: "var(--on-dark)",
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                  <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
                  <button className="btn gold" onClick={() => setStep(3)}>Review</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="caption">Review</div>
                <div className="card" style={{ padding: 12 }}>
                  <div><strong>Title:</strong> {title || "—"}</div>
                  <div><strong>Estimated Cost:</strong> {Core.formatMoney(cost)}</div>
                  <div><strong>Risks:</strong> {risk || "—"}</div>
                  <div><strong>Impact:</strong> {impact || "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                  <button className="btn ghost" onClick={() => setStep(2)}>Back</button>
                  <button
                    className="btn gold"
                    onClick={() => {
                      const payload = { title, cost, risk, impact };
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = "proposal.json"; a.click();
                      URL.revokeObjectURL(url);
                      alert("Proposal exported as JSON (demo).");
                    }}
                  >
                    Export JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </LockGate>
  );
}

/* =======================================================================================
 * TEAM SECTION — cards
 * ======================================================================================= */

function TeamSection() {
  return (
    <section className="section">
      <div className="container">
        <h2>Your 2029 SGA</h2>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}
        >
          {Core.team.map((m) => (
            <div key={m.id} className="card ripple" style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <img
                  src={m.avatar ?? "/img/gallery-1.jpg"}
                  alt={`${m.name} avatar`}
                  width={56}
                  height={56}
                  style={{ borderRadius: 12 }}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div className="caption">{m.role}</div>
                </div>
              </div>
              <p style={{ marginTop: 10 }}>{m.bio ?? "—"}</p>
              <div className="caption">Office hours: {m.officeHours ?? "TBD"}</div>
              <a className="btn ghost" href={`mailto:${m.email}`} style={{ marginTop: 10 }}>
                Contact
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =======================================================================================
 * ADMIN SECTION — sync cards, audit log (mock)
 * ======================================================================================= */

function AdminSection() {
  return (
    <LockGate>
      <section className="section">
        <div className="container">
          <h2>Admin</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <div className="caption">Sheet sync status</div>
              <div style={{ marginTop: 8 }}>Healthy</div>
              <div className="caption">Last import: 2h ago</div>
              <button className="btn ghost" style={{ marginTop: 10 }}>
                Re-pull now
              </button>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="caption">Queued pushes</div>
              <ul style={{ margin: 0 }}>
                <li>No pending</li>
              </ul>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="caption">Maintenance</div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn ghost">Toggle Read-only</button>
                <button className="btn ghost">Close Proposals</button>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <div className="caption">Audit Log</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div className="card" style={{ padding: 10 }}>
                <div className="caption">11/06 14:10 — bill b-001 status → Approved</div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
{`{
  "op":"replace","path":"/status","from":"Submitted","to":"Approved"
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>
    </LockGate>
  );
}

/* =======================================================================================
 * SOCIAL PULSE — masonry grid with modal media
 * ======================================================================================= */

function SocialPulse(props: { onOpenMedia: (m: { url: string; alt?: string }) => void }) {
  // Simple CSS columns masonry
  return (
    <section className="section">
      <div className="container">
        <h2>Right Now on SGA Socials</h2>
        <div style={{ columnCount: 3, columnGap: 16 }}>
          {Core.socials.map((s) => (
            <div key={s.id} className="card ripple" style={{ breakInside: "avoid", marginBottom: 16, overflow:"hidden" }}>
              {s.media && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => props.onOpenMedia({ url: s.media!, alt: s.text })}
                  onKeyDown={(e) => e.key === "Enter" && props.onOpenMedia({ url: s.media!, alt: s.text })}
                  style={{
                    height: 200,
                    background: `url(${s.media}) center/cover no-repeat`,
                    cursor: "pointer",
                  }}
                  aria-label="Open media"
                />
              )}
              <div style={{ padding: 12 }}>
                <div className="caption">{s.network.toUpperCase()} · {Core.yyyyMmDd(s.ts)}</div>
                <p style={{ marginTop: 6 }}>{s.text}</p>
                <a className="btn link" href={s.url} target="_blank" rel="noreferrer">Open</a>
              </div>
            </div>
          ))}
        </div>
        <div className="caption" style={{ marginTop: 8 }}>
          Follow <a className="btn link" href="https://instagram.com/hpu2029sga">@HPU2029SGA</a> to see it live.
        </div>
      </div>
    </section>
  );
}

/* =======================================================================================
 * GET INVOLVED DOCK — liquid magnet hover
 * ======================================================================================= */

function GetInvolvedDock() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onMove = (e: MouseEvent) => {
      const cards = Array.from(wrap.querySelectorAll<HTMLElement>(".action"));
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        const cx = r.left - rect.left + r.width / 2;
        const cy = r.top - rect.top + r.height / 2;
        const dx = (mx - cx) / Math.max(r.width, 1);
        const dy = (my - cy) / Math.max(r.height, 1);
        const mag = Math.max(0, 1 - Math.hypot(dx, dy));
        c.style.transform = `translate(${dx * 6 * mag}px, ${dy * 6 * mag}px) scale(${1 + 0.02 * mag})`;
      }
    };
    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", () => {
      const cards = Array.from(wrap.querySelectorAll<HTMLElement>(".action"));
      for (const c of cards) c.style.transform = "";
    });
    return () => {
      wrap.removeEventListener("mousemove", onMove);
    };
  }, []);
  return (
    <section className="section">
      <div className="container">
        <h2>Your Move</h2>
        <div className="dock" ref={wrapRef}>
          <a className="action" href="/events">Join an event</a>
          <a className="action" href="/proposals">Propose an idea</a>
          <a className="action" href="/team">Office hours</a>
          <a className="action" href="mailto:2029treasurer@highpoint.edu">Contact SGA</a>
        </div>
        {!Core.isInvited() && (
          <div className="caption" style={{ textAlign: "center", marginTop: 10 }}>
            Full ledger/bills access is invite-only in this preview.
          </div>
        )}
      </div>
    </section>
  );
}

/* =======================================================================================
 * FLIP helpers (hero portal targets)
 * ======================================================================================= */

function rectForRail(): DOMRect {
  // Approximate rail target across the viewport top third
  const w = Math.min(980, window.innerWidth * 0.92);
  const h = Math.min(420, window.innerHeight * 0.48);
  const x = (window.innerWidth - w) / 2;
  const y = 120;
  return new DOMRect(x, y, w, h);
}

function rectForLedgerHeader(): DOMRect {
  const w = Math.min(980, window.innerWidth * 0.92);
  const h = 120;
  const x = (window.innerWidth - w) / 2;
  const y = 120;
  return new DOMRect(x, y, w, h);
}

function rectForCenteredModal(): DOMRect {
  const vw = Math.max(360, Math.min(980, window.innerWidth * 0.92));
  const vh = Math.min(680, window.innerHeight * 0.86);
  const left = (window.innerWidth - vw) / 2;
  const top = (window.innerHeight - vh) / 2;
  return new DOMRect(left, top, vw, vh);
}

/* =======================================================================================
 * END
 * ======================================================================================= */
