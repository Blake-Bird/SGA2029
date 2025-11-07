// src/lib/core.ts
// HPU Class of 2029 SGA — Core app brain: routing, invite gate, data models, seeds,
// filters/sorts/pagination, KPI compute, CSV builder, and "explain this view" composer.
// No external deps. Browser + SSR safe (guards around window/localStorage).

/* =====================================================================================
 * 0) Types & Route Model
 * ===================================================================================== */

export type RouteKind =
  | "home"
  | "events"
  | "eventDetail"
  | "ledger"
  | "bills"
  | "billDetail"
  | "proposals"
  | "team"
  | "admin";

export type ParsedRoute =
  | { kind: "home" }
  | { kind: "events" }
  | { kind: "eventDetail"; id: string }
  | { kind: "ledger" }
  | { kind: "bills" }
  | { kind: "billDetail"; id: string }
  | { kind: "proposals" }
  | { kind: "team" }
  | { kind: "admin" };

export type MoneyCents = number; // store in cents; format later

export type Committee =
  | "Community Service"
  | "Philanthropy"
  | "Social Events"
  | "Event Funding"
  | "Social Media";

export type BillStatus = "Draft" | "Submitted" | "Approved" | "Denied" | "Revised";

export type TxnType = "allocation" | "expense" | "revenue" | "transfer";

export interface TeamMember {
  id: string;
  name: string;
  role:
    | "President"
    | "Vice President"
    | "Treasurer"
    | "Social Events Lead"
    | "Social Media Lead";
  email: string;
  officeHours?: string;
  bio?: string;
  avatar?: string; // URL
  focus?: string; // "What I’m working on"
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // ISO
  location: string;
  type: "Social" | "Service" | "Philanthropy" | "Workshop" | "Other";
  committee: Committee;
  estimateCents?: MoneyCents;
  poster?: string; // URL image or loop
  summary?: string;
}

export interface Bill {
  id: string;
  title: string;
  amountCents: MoneyCents;
  status: BillStatus;
  committee: Committee;
  submittedAt: string; // ISO
  decidedAt?: string; // ISO
  justification?: string;
  attachments?: string[];
}

export interface Transaction {
  id: string;
  date: string; // ISO
  type: TxnType;
  amountCents: MoneyCents; // positive for inflow (allocation/revenue), negative for outflow (expense/transfer out)
  vendor?: string;
  memo?: string;
  eventId?: string;
  billId?: string;
  link?: string; // receipt URL, invoice, etc.
}

export interface KPIs {
  currentBalanceCents: MoneyCents;
  inflowYTD: MoneyCents;
  outflowYTD: MoneyCents;
}

export interface SocialItem {
  id: string;
  network: "instagram" | "x" | "tiktok" | "youtube";
  text: string;
  media?: string; // image/video URL
  url: string;
  ts: string; // ISO
}

/* =====================================================================================
 * 1) Tiny Runtime Introspection & Utilities
 * ===================================================================================== */

const isBrowser = typeof window !== "undefined";
const isProd = process.env.NODE_ENV === "production";

/** Safe localStorage get/set with SSR guards */
const storage = {
  get(key: string): string | null {
    try {
      if (!isBrowser) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, val: string) {
    try {
      if (!isBrowser) return;
      window.localStorage.setItem(key, val);
    } catch {
      /* noop */
    }
  },
  remove(key: string) {
    try {
      if (!isBrowser) return;
      window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function sum(arr: number[]) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

export function cents(n: number) {
  // convenience for seeds: dollars → cents
  return Math.round(n * 100);
}

export function formatMoney(c: MoneyCents, currency = "USD") {
  const abs = Math.abs(c) / 100;
  const f = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(abs);
  return c < 0 ? `-${f}` : f;
}

export function yyyyMmDd(iso: string) {
  return iso.slice(0, 10);
}

/* =====================================================================================
 * 2) Simple Router (URL → ParsedRoute)
 * ===================================================================================== */

export function routeOf(urlOrPath: string): ParsedRoute {
  const url = urlOrPath.includes("://")
    ? new URL(urlOrPath)
    : new URL(urlOrPath, "https://example.com");
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);

  // /
  if (parts.length === 0) return { kind: "home" };

  // /events | /events/:id
  if (parts[0] === "events") {
    if (parts[1]) return { kind: "eventDetail", id: decodeURIComponent(parts[1]) };
    return { kind: "events" };
  }

  // /ledger
  if (parts[0] === "ledger") return { kind: "ledger" };

  // /bills | /bills/:id
  if (parts[0] === "bills") {
    if (parts[1]) return { kind: "billDetail", id: decodeURIComponent(parts[1]) };
    return { kind: "bills" };
  }

  // /proposals
  if (parts[0] === "proposals") return { kind: "proposals" };

  // /team
  if (parts[0] === "team") return { kind: "team" };

  // /admin
  if (parts[0] === "admin") return { kind: "admin" };

  // default → home
  return { kind: "home" };
}

export function hrefFor(route: ParsedRoute): string {
  switch (route.kind) {
    case "home":
      return "/";
    case "events":
      return "/events";
    case "eventDetail":
      return `/events/${encodeURIComponent(route.id)}`;
    case "ledger":
      return "/ledger";
    case "bills":
      return "/bills";
    case "billDetail":
      return `/bills/${encodeURIComponent(route.id)}`;
    case "proposals":
      return "/proposals";
    case "team":
      return "/team";
    case "admin":
      return "/admin";
  }
}

/* =====================================================================================
 * 3) Invite Gate (5 emails) — passwordless preview
 * ===================================================================================== */

const INVITE_KEY = "sga2029.invite";
const allowedEnv =
  (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || process.env.ALLOWED_EMAILS || "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const FALLBACK_ALLOWED = [
  "2029president@highpoint.edu",
  "2029vp@highpoint.edu",
  "2029treasurer@highpoint.edu",
  "2029social@highpoint.edu",
  "2029marketing@highpoint.edu",
];

const ALLOWED_EMAILS = (allowedEnv.length ? allowedEnv : FALLBACK_ALLOWED).slice(0, 5);

export function allowedEmails(): string[] {
  return ALLOWED_EMAILS.slice();
}

function hashEmail(email: string) {
  // ultra-light, not cryptographic; demo only
  let h = 2166136261;
  const s = email.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "h" + (h >>> 0).toString(16);
}

export function signIn(email: string): { ok: boolean; reason?: string } {
  const e = (email || "").trim().toLowerCase();
  if (!e.includes("@")) return { ok: false, reason: "Invalid email" };
  if (!ALLOWED_EMAILS.includes(e)) return { ok: false, reason: "Not invited" };
  const token = `${e}.${hashEmail(e)}`;
  storage.set(INVITE_KEY, token);
  return { ok: true };
}

export function signOut() {
  storage.remove(INVITE_KEY);
}

export function isInvited(): boolean {
  const token = storage.get(INVITE_KEY);
  if (!token) return false;
  const [email, h] = token.split(".");
  if (!email || !h) return false;
  return ALLOWED_EMAILS.includes(email) && h === hashEmail(email);
}

export function currentInviteEmail(): string | null {
  const token = storage.get(INVITE_KEY);
  if (!token) return null;
  const [email, h] = token.split(".");
  if (!email || h !== hashEmail(email)) return null;
  return email;
}

/* =====================================================================================
 * 4) Seed Data (team, events, bills, transactions, socials)
 * ===================================================================================== */

// Team (5)
export const team: TeamMember[] = [
  {
    id: "t1",
    name: "David Park",
    role: "President",
    email: "2029president@highpoint.edu",
    officeHours: "Mon 2–4 PM, Cottrell Lobby",
    avatar: "/img/gallery-1.jpg",
    focus: "Flagship events & partnerships.",
    bio: "Leading with optimism and execution—building signature experiences.",
  },
  {
    id: "t2",
    name: "Sean Miller",
    role: "Vice President",
    email: "2029vp@highpoint.edu",
    officeHours: "Wed 1–3 PM, Smith Library",
    avatar: "/img/gallery-2.jpg",
    focus: "Community service initiatives at scale.",
    bio: "Bridging campus and community with meaningful service.",
  },
  {
    id: "t3",
    name: "Blake Bird",
    role: "Treasurer",
    email: "2029treasurer@highpoint.edu",
    officeHours: "Tue 10–12 AM, Cottrell 2F",
    avatar: "/img/hero.jpg",
    focus: "Transparent budgeting, explainable ledger.",
    bio: "Turning numbers into stories students can explore.",
  },
  {
    id: "t4",
    name: "Preston Cole",
    role: "Social Events Lead",
    email: "2029social@highpoint.edu",
    officeHours: "Thu 3–5 PM, Slane Center",
    avatar: "/img/gallery-1.jpg",
    focus: "High-energy, inclusive socials.",
    bio: "Designing nights you’ll remember for the right reasons.",
  },
  {
    id: "t5",
    name: "Anya Patel",
    role: "Social Media Lead",
    email: "2029marketing@highpoint.edu",
    officeHours: "Fri 11–1 PM, Communications Annex",
    avatar: "/img/gallery-2.jpg",
    focus: "Clarity, reach, and hype—without spam.",
    bio: "Translating student life into moments worth sharing.",
  },
];

// Flagship Events
export const events: EventItem[] = [
  {
    id: "e-boba",
    title: "Boba Recharge & Refresh",
    date: "2025-11-20T18:00:00-05:00",
    location: "Panther Commons",
    type: "Social",
    committee: "Social Events",
    estimateCents: cents(900),
    poster: "/img/gallery-1.jpg",
    summary: "Grab boba, decompress, and meet your class.",
  },
  {
    id: "e-crown",
    title: "The Crown Affair (Poker Night)",
    date: "2025-11-18T19:30:00-05:00",
    location: "Panther Commons Ballroom",
    type: "Social",
    committee: "Social Events",
    estimateCents: cents(2500),
    poster: "/img/gallery-2.jpg",
    summary: "A classy night with mocktails, prizes, and networking.",
  },
  {
    id: "e-serve",
    title: "Jump Rope for Her",
    date: "2026-02-15T11:00:00-05:00",
    location: "Slane Courts",
    type: "Philanthropy",
    committee: "Philanthropy",
    estimateCents: cents(1200),
    poster: "/img/hero.jpg",
    summary: "Fundraiser & awareness event with community partners.",
  },
];

// Bills
export const bills: Bill[] = [
  {
    id: "b-001",
    title: "Boba Recharge Supplies",
    amountCents: cents(900),
    status: "Approved",
    committee: "Social Events",
    submittedAt: "2025-11-05T09:30:00-05:00",
    decidedAt: "2025-11-06T14:10:00-05:00",
    justification: "100 cups @ $6 avg, covers tax/fees; popular stress-relief.",
  },
  {
    id: "b-002",
    title: "The Crown Affair Prizes",
    amountCents: cents(2000),
    status: "Submitted",
    committee: "Social Events",
    submittedAt: "2025-11-10T12:00:00-05:00",
    justification: "Prizes drive turnout; curated for inclusive engagement.",
  },
  {
    id: "b-003",
    title: "Service Event Equipment",
    amountCents: cents(600),
    status: "Draft",
    committee: "Philanthropy",
    submittedAt: "2025-11-12T16:20:00-05:00",
  },
];

// Transactions (mixed)
export const transactions: Transaction[] = [
  // allocations (inflows)
  { id: "t-alloc-1", date: "2025-08-28", type: "allocation", amountCents: cents(8000), memo: "Fall allocation" },
  { id: "t-alloc-2", date: "2025-10-01", type: "allocation", amountCents: cents(2000), memo: "Supplemental allocation" },

  // expenses (outflows)
  { id: "t-exp-1", date: "2025-11-06", type: "expense", amountCents: -cents(900), vendor: "Boba Vendor LLC", memo: "Boba Recharge", eventId: "e-boba", billId: "b-001", link: "#" },
  { id: "t-exp-2", date: "2025-11-20", type: "expense", amountCents: -cents(480), vendor: "Print House", memo: "Posters & table tents", eventId: "e-boba", link: "#" },
  { id: "t-exp-3", date: "2025-11-19", type: "expense", amountCents: -cents(650), vendor: "Decor Co", memo: "Poker Night decor", eventId: "e-crown", billId: "b-002", link: "#" },

  // revenue (inflows)
  { id: "t-rev-1", date: "2025-11-21", type: "revenue", amountCents: cents(120), vendor: "Donations", memo: "Tip jar after boba" },

  // transfer (outflow)
  { id: "t-tr-1", date: "2025-09-05", type: "transfer", amountCents: -cents(300), memo: "Shared cost to another org" },
];

// Social (static sample)
export const socials: SocialItem[] = [
  {
    id: "s-1",
    network: "instagram",
    text: "Boba Recharge was a vibe. Thank you, Panthers!",
    media: "/img/gallery-1.jpg",
    url: "https://instagram.com/hpu2029sga",
    ts: "2025-11-21T14:00:00-05:00",
  },
  {
    id: "s-2",
    network: "x",
    text: "Crown Affair loading… prizes polished, mocktails chilled.",
    media: "/img/gallery-2.jpg",
    url: "https://x.com/hpu2029sga",
    ts: "2025-11-16T09:00:00-05:00",
  },
];

/* =====================================================================================
 * 5) Filters / Sorts / Pagination
 * ===================================================================================== */

export type TxnFilter = {
  type?: TxnType | "all";
  from?: string; // ISO yyyy-mm-dd
  to?: string; // ISO yyyy-mm-dd
  search?: string; // vendor/memo substring
  eventId?: string;
  billId?: string;
};

export function filterTransactions(rows: Transaction[], f: TxnFilter): Transaction[] {
  const needle = (f.search || "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.type && f.type !== "all" && r.type !== f.type) return false;
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    if (f.eventId && r.eventId !== f.eventId) return false;
    if (f.billId && r.billId !== f.billId) return false;
    if (needle) {
      const hay = `${r.vendor || ""} ${r.memo || ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export type TxnSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export function sortTransactions(rows: Transaction[], key: TxnSortKey): Transaction[] {
  const arr = rows.slice();
  switch (key) {
    case "date_desc":
      arr.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      break;
    case "date_asc":
      arr.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
      break;
    case "amount_desc":
      arr.sort((a, b) => b.amountCents - a.amountCents);
      break;
    case "amount_asc":
      arr.sort((a, b) => a.amountCents - b.amountCents);
      break;
  }
  return arr;
}

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const p = clamp(page, 1, pages);
  const start = (p - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return {
    page: p,
    pageSize,
    total,
    pages,
    rows: rows.slice(start, end),
  };
}

/* =====================================================================================
 * 6) KPIs & Derivations
 * ===================================================================================== */

export function computeKPIs(rows: Transaction[], year?: number): KPIs {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const yStr = String(y);
  let inflow = 0;
  let outflow = 0;
  let balance = 0;

  for (const r of rows) {
    balance += r.amountCents;
    if (r.date.startsWith(yStr)) {
      if (r.amountCents >= 0) inflow += r.amountCents;
      else outflow += r.amountCents; // negative number
    }
  }
  return {
    currentBalanceCents: balance,
    inflowYTD: inflow,
    outflowYTD: outflow, // negative
  };
}

export function linkBillTransactions(billId: string, rows: Transaction[]): Transaction[] {
  return rows.filter((r) => r.billId === billId);
}

export function linkEventTransactions(eventId: string, rows: Transaction[]): Transaction[] {
  return rows.filter((r) => r.eventId === eventId);
}

/* =====================================================================================
 * 7) CSV Builder (WYSIWYG style)
 * ===================================================================================== */

export type CSVColumn<T> = {
  key: string;
  title: string;
  value: (row: T, idx: number) => string | number | null | undefined;
};

export function toCSV<T>(rows: T[], cols: CSVColumn<T>[], delimiter = ","): string {
  const head = cols.map((c) => csvEscape(c.title, delimiter)).join(delimiter);
  const body = rows
    .map((r, i) =>
      cols
        .map((c) => csvEscape(valueString(c.value(r, i)), delimiter))
        .join(delimiter)
    )
    .join("\n");
  return head + "\n" + body;
}

function valueString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v);
}

function csvEscape(s: string, delimiter = ","): string {
  const needs = s.includes(delimiter) || s.includes('"') || s.includes("\n");
  if (!needs) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/* =====================================================================================
 * 8) Explain-This-View Composer
 * ===================================================================================== */

export function explainTransactionsView(f: TxnFilter, sort: TxnSortKey): string {
  const parts: string[] = [];

  // Type
  if (!f.type || f.type === "all") parts.push("all transaction types");
  else parts.push(labelTxnType(f.type));

  // Date range
  if (f.from && f.to) parts.push(`from ${f.from} to ${f.to}`);
  else if (f.from) parts.push(`from ${f.from}`);
  else if (f.to) parts.push(`up to ${f.to}`);

  // Linkages
  if (f.eventId) {
    const ev = events.find((e) => e.id === f.eventId);
    parts.push(`for event “${ev?.title ?? f.eventId}”`);
  }
  if (f.billId) {
    const b = bills.find((x) => x.id === f.billId);
    parts.push(`linked to bill “${b?.title ?? f.billId}”`);
  }

  // Search
  if (f.search && f.search.trim()) parts.push(`matching “${f.search.trim()}”`);

  // Sort
  const sortLabel = (() => {
    switch (sort) {
      case "date_desc":
        return "most recent first";
      case "date_asc":
        return "oldest first";
      case "amount_desc":
        return "highest amount first";
      case "amount_asc":
        return "lowest amount first";
    }
  })();

  const sentence =
    "Showing " +
    parts.join(", ") +
    (sortLabel ? `, ${sortLabel}` : "") +
    ".";

  return sentence.replace(/\s+,/g, ","); // tidy punctuation
}

function labelTxnType(t: TxnType): string {
  switch (t) {
    case "allocation":
      return "allocations";
    case "expense":
      return "expenses";
    case "revenue":
      return "revenues";
    case "transfer":
      return "transfers";
  }
}

/* =====================================================================================
 * 9) High-level Query Helper (filter → sort → paginate)
 * ===================================================================================== */

export type TxnQuery = {
  filter: TxnFilter;
  sort: TxnSortKey;
  page: number;
  pageSize: number;
};

export function queryTransactions(q: TxnQuery) {
  const filtered = filterTransactions(transactions, q.filter);
  const sorted = sortTransactions(filtered, q.sort);
  return paginate(sorted, q.page, q.pageSize);
}

/* =====================================================================================
 * 10) Dev Self-Test (optional, safe to ignore in prod)
 * ===================================================================================== */

export function selfTest(): string[] {
  const issues: string[] = [];

  // Router
  const r1 = routeOf("/");
  if (r1.kind !== "home") issues.push("routeOf('/') failed");

  const r2 = routeOf("/events");
  if (r2.kind !== "events") issues.push("routeOf('/events') failed");

  const r3 = routeOf("/events/e-boba");
  if (!(r3.kind === "eventDetail" && r3.id === "e-boba"))
    issues.push("routeOf('/events/:id') failed");

  // Invite
  const a = allowedEmails();
  if (a.length !== 5) issues.push("allowedEmails length !== 5");

  // Filters
  const onlyExp = filterTransactions(transactions, { type: "expense" });
  if (!onlyExp.every((x) => x.type === "expense")) issues.push("filter by expense failed");

  // Sorts
  const asc = sortTransactions(transactions, "amount_asc");
  for (let i = 1; i < asc.length; i++) {
    if (asc[i - 1].amountCents > asc[i].amountCents) {
      issues.push("amount_asc sort failed");
      break;
    }
  }

  // KPIs
  const k = computeKPIs(transactions, 2025);
  if (typeof k.currentBalanceCents !== "number") issues.push("computeKPIs failed");

  // CSV
  const csv = toCSV(
    transactions.slice(0, 2),
    [
      { key: "date", title: "Date", value: (r) => r.date },
      { key: "type", title: "Type", value: (r) => r.type },
      { key: "amt", title: "Amount", value: (r) => formatMoney(r.amountCents) },
    ],
    ","
  );
  if (!csv.includes("Date,Type,Amount")) issues.push("CSV header failed");

  // Explain
  const expl = explainTransactionsView(
    { type: "expense", from: "2025-11-01", to: "2025-11-30", search: "boba" },
    "date_desc"
  );
  if (!/Showing expenses/.test(expl)) issues.push("Explain view failed");

  return issues;
}

/* =====================================================================================
 * 11) Public Facade (optional convenience)
 * ===================================================================================== */

export const Core = {
  // routing
  routeOf,
  hrefFor,

  // invite
  allowedEmails,
  signIn,
  signOut,
  isInvited,
  currentInviteEmail,

  // data
  team,
  events,
  bills,
  transactions,
  socials,

  // views
  filterTransactions,
  sortTransactions,
  paginate,
  queryTransactions,
  computeKPIs,
  linkBillTransactions,
  linkEventTransactions,

  // io/ux
  toCSV,
  explainTransactionsView,

  // utils
  formatMoney,
  yyyyMmDd,

  // test
  selfTest,
};
