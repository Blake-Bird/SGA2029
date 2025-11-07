// src/lib/portal.ts
export function portalToSelector(selector: string): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
