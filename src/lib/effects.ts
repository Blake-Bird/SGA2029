// src/lib/effects.ts
// All animation systems in one place — waterline canvas, FLIP portals,
// orbit driver (with hover-lift FLIP), global ripple variables,
// bill-fold 3D orchestrator, countUp, and shared easings.
//
// No external deps. All effects auto-no-op under reduced-motion and pause on tab blur.

type Maybe<T> = T | null;

/* =======================================================================================
 * 0) Runtime & Motion Guards
 * ======================================================================================= */

const isBrowser = typeof window !== "undefined";
const mqlReduced = isBrowser
  ? window.matchMedia?.("(prefers-reduced-motion: reduce)")
  : (null as Maybe<MediaQueryList>);

export function prefersReducedMotion(): boolean {
  try {
    return !!mqlReduced?.matches;
  } catch {
    return false;
  }
}

let pageHidden = false;
if (isBrowser) {
  document.addEventListener("visibilitychange", () => {
    pageHidden = document.hidden;
  });
}

/* =======================================================================================
 * 1) Easing Curves (shared)
 * ======================================================================================= */

export const Ease = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeIn: (t: number) => t * t * t,
  emph: (t: number) => 1 - Math.pow(1 - t, 1.6), // punchy exit
  soft: (t: number) => t * (2 - t),
  springSnappy: (t: number) => {
    // cubic-bezier(.34,1.56,.42,1) approximation
    const s = 1.56;
    return 1 - Math.pow(1 - t, s);
  },
  springBouncy: (t: number) => {
    // playful overshoot
    const p = 0.6;
    return 1 + Math.sin((t - 1) * (1 / p)) * Math.pow(1 - t, 2.2);
  },
};

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/* =======================================================================================
 * 2) CountUp (RAF, GC-free)
 * ======================================================================================= */

export function countUp(
  el: HTMLElement,
  endValue: number,
  durationMs = 900,
  formatter: (n: number) => string = (n) => Math.round(n).toString(),
  ease = Ease.easeOut
) {
  if (!isBrowser || prefersReducedMotion()) {
    el.textContent = formatter(endValue);
    return;
  }
  let raf = 0;
  const start = performance.now();
  const from = 0;
  const step = (now: number) => {
    if (pageHidden) {
      raf = requestAnimationFrame(step);
      return;
    }
    const p = clamp01((now - start) / durationMs);
    const v = from + (endValue - from) * ease(p);
    el.textContent = formatter(v);
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/* =======================================================================================
 * 3) Waterline Canvas (shader-like waves, ripples, pause-on-blur)
 * ======================================================================================= */

export type WaterlineHandle = {
  pulse: (strength?: number) => void;
  destroy: () => void;
};

export function initWaterline(canvas: HTMLCanvasElement): WaterlineHandle | undefined {
  if (!isBrowser) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const reduced = prefersReducedMotion();
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let rafId = 0;
  let t0 = performance.now();
  let w = 0,
    h = 0;

  // wave state
  const waves = [
    { amp: 4, freq: 0.012, speed: 0.7, phase: 0 },
    { amp: 2, freq: 0.02, speed: 1.1, phase: Math.PI / 2 },
    { amp: 1.2, freq: 0.04, speed: 1.6, phase: Math.PI },
  ];

  // ripple pulse
  let pulseStrength = 0;
  function pulse(strength = 1) {
    pulseStrength = Math.min(2.5, pulseStrength + strength);
  }

  function resize() {
  const rect = canvas.getBoundingClientRect();
  w = Math.max(200, rect.width);
  h = Math.max(8, rect.height);
  canvas.width = Math.round(w * DPR);
  canvas.height = Math.round(h * DPR);
  if (!ctx) return; // ← guard for TS
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

  function draw(now: number) {
  if (pageHidden) {
    rafId = requestAnimationFrame(draw);
    return;
  }
  if (!ctx) return; // ← guard for TS

  const dt = (now - t0) / 1000;
  t0 = now;

  ctx.clearRect(0, 0, w, h);

  // background gradient
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(201,179,126,0.22)");
  g.addColorStop(1, "rgba(75,23,150,0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // composite waves
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < waves.length; i++) {
    const { amp, freq, speed, phase } = waves[i];
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const nx = x / w;
      const y =
        h / 2 +
        Math.sin(nx * Math.PI * 2 + (now / 1000) * speed + phase) * amp +
        Math.sin(nx * Math.PI * 2 * (1 / freq) + (now / 1000) * (speed * 0.7)) *
          (amp * 0.1);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)";
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // ripple pulse overlay
  if (pulseStrength > 0.001) {
    const grad = ctx.createRadialGradient(w * 0.1, h * 0.5, 0, w * 0.4, h * 0.5, w * 0.5);
    grad.addColorStop(0, `rgba(255,255,255,${0.08 * pulseStrength})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // decay
    pulseStrength *= Math.pow(0.85, dt * 60);
  }

  if (!reduced) rafId = requestAnimationFrame(draw);
}


  resize();
  window.addEventListener("resize", resize);

  if (!prefersReducedMotion()) {
    rafId = requestAnimationFrame(draw);
  } else {
  // static bar for reduced motion
  if (!ctx) return; // ← guard for TS
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, h * 0.35, w, h * 0.3);
}


  return {
    pulse,
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      if (!ctx) return; // ← guard for TS
      ctx.clearRect(0, 0, w, h);
    },
  };
}

/* =======================================================================================
 * 4) FLIP Portal (clone element → transform into target rect)
 * ======================================================================================= */

export type PortalOptions = {
  duration?: number; // ms
  ease?: (t: number) => number;
  fade?: boolean;
  scaleBias?: number; // initial scale up (e.g., 1.06)
};

export function playPortal(fromEl: HTMLElement, toRect: DOMRect, opts: PortalOptions = {}) {
  if (!isBrowser || prefersReducedMotion()) return;

  const rect = fromEl.getBoundingClientRect();
  const clone = fromEl.cloneNode(true) as HTMLElement;
  const duration = opts.duration ?? 420;
  const ease = opts.ease ?? Ease.easeOut;
  const scaleBias = opts.scaleBias ?? 1.06;

  // style clone
  clone.style.position = "fixed";
  clone.style.top = rect.top + "px";
  clone.style.left = rect.left + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";
  clone.style.margin = "0";
  clone.style.zIndex = "350"; // matches --z-portal
  clone.style.pointerEvents = "none";
  clone.style.willChange = "transform, opacity";
  clone.style.transformOrigin = "center center";
  clone.style.borderRadius = window.getComputedStyle(fromEl).borderRadius;

  // overlay to mask background flash (optional glow)
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background =
    "radial-gradient(60% 80% at 50% 30%, rgba(0,0,0,.38), rgba(0,0,0,.20))";
  overlay.style.zIndex = "340";
  overlay.style.opacity = "0";

  document.body.appendChild(overlay);
  document.body.appendChild(clone);

  const sx = rect.width / toRect.width;
  const sy = rect.height / toRect.height;
  const dx = toRect.left - rect.left;
  const dy = toRect.top - rect.top;
  const start = performance.now();

  let raf = 0;
  const step = (now: number) => {
    if (pageHidden) {
      raf = requestAnimationFrame(step);
      return;
    }
    const p = clamp01((now - start) / duration);
    const k = ease(p);

    const invX = 1 / (sx + (1 - sx) * k);
    const invY = 1 / (sy + (1 - sy) * k);
    const tx = dx * k;
    const ty = dy * k;

    const bias = 1 + (scaleBias - 1) * (1 - k); // shrink bias over time
    clone.style.transform = `translate(${tx}px, ${ty}px) scale(${invX * bias},${
      invY * bias
    })`;
    clone.style.opacity = opts.fade ? String(1 - p * 0.2) : "1";
    overlay.style.opacity = String(0.5 * k);

    if (p < 1) raf = requestAnimationFrame(step);
    else {
      document.body.removeChild(clone);
      document.body.removeChild(overlay);
      cancelAnimationFrame(raf);
    }
  };
  raf = requestAnimationFrame(step);
}

/* =======================================================================================
 * 5) Orbit Driver (parametric circle + hover-lift FLIP)
 * ======================================================================================= */

export type OrbitHandle = {
  destroy: () => void;
};

type OrbitOpts = {
  radius?: number;
  speed?: number; // radians/sec
  items: HTMLElement[];
};

export function startOrbit(container: HTMLElement, opts: OrbitOpts): OrbitHandle | undefined {
  if (!isBrowser) return;
  const reduced = prefersReducedMotion();
  const { items, radius = 220, speed = 0.4 } = opts;
  if (!items?.length) return;

  let raf = 0;
  let t0 = performance.now();
  const phases = items.map((_, i) => (i / items.length) * Math.PI * 2);

  // hover lift via FLIP
  const hover = new Set<HTMLElement>();
  const enter = (el: HTMLElement) => {
    if (reduced) return;
    hover.add(el);
    // FLIP: first
    const first = el.getBoundingClientRect();
    el.style.transform += " translateZ(60px) scale(1.06)";
    el.style.filter = "saturate(1.08) brightness(1.03)";
    // last
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / last.width;
    const sy = first.height / last.height;
    el.animate(
      [
        { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` },
        { transform: "none" },
      ],
      { duration: 360, easing: "cubic-bezier(.34,1.56,.42,1)" }
    );
  };
  const leave = (el: HTMLElement) => {
    hover.delete(el);
    el.style.transform = ""; // orbit step will reapply
    el.style.filter = "";
  };

  items.forEach((el) => {
    el.style.position = "absolute";
    el.style.transformStyle = "preserve-3d";
    el.style.willChange = "transform, filter";
    el.addEventListener("mouseenter", () => enter(el));
    el.addEventListener("mouseleave", () => leave(el));
  });

  function layout(now: number) {
    if (pageHidden) {
      raf = requestAnimationFrame(layout);
      return;
    }
    const dt = (now - t0) / 1000;
    t0 = now;
    const angleBase = now / 1000 * speed;

    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      const a = angleBase + phases[i];
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * (radius * 0.55);

      const tiltX = Math.sin(a) * 6; // deg
      const tiltY = Math.cos(a) * 6;

      if (!hover.has(el)) {
        el.style.transform = `translate(${x - el.clientWidth / 2}px, ${
          y - el.clientHeight / 2
        }px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        el.style.filter = "saturate(1.0)";
      }
    }
    if (!reduced) raf = requestAnimationFrame(layout);
  }

  if (!reduced) raf = requestAnimationFrame(layout);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      items.forEach((el) => {
        el.replaceWith(el); // quick remove listeners by cloning
      });
    },
  };
}

/* =======================================================================================
 * 6) Global Ripple (mousemove → CSS vars --mx/--my on .ripple ancestors)
 * ======================================================================================= */

let rippleBound = false;
export function bindGlobalRipple() {
  if (!isBrowser || rippleBound) return;
  rippleBound = true;

  const handler = (e: MouseEvent) => {
    if (prefersReducedMotion()) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const host = target.closest<HTMLElement>(".ripple");
    if (!host) return;
    const r = host.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    host.style.setProperty("--mx", `${mx}px`);
    host.style.setProperty("--my", `${my}px`);
  };

  window.addEventListener("mousemove", handler, { passive: true });

  return () => {
    window.removeEventListener("mousemove", handler);
    rippleBound = false;
  };
}

/* =======================================================================================
 * 7) BillFold (CSS 3D flip with programmatic control)
 * ======================================================================================= */

export type FoldHandle = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  destroy: () => void;
};

export function mountFold(root: HTMLElement, options?: { duration?: number }) {
  if (!isBrowser) return;
  const reduced = prefersReducedMotion();
  root.style.perspective = "1200px";
  root.style.transformStyle = "preserve-3d";
  root.style.willChange = "transform";

  const front = root.querySelector<HTMLElement>(".card-face.front");
  const back = root.querySelector<HTMLElement>(".card-face.back");
  if (!front || !back) {
    console.warn("mountFold: missing .card-face.front/back");
    return;
  }

  const dur = options?.duration ?? 520;
  let openState = false;

  function setOpen(v: boolean) {
    openState = v;
    if (reduced) {
      front.style.transform = v ? "rotateY(-180deg)" : "rotateY(0deg)";
      back.style.transform = v ? "rotateY(0deg)" : "rotateY(180deg)";
      return;
    }
    const start = performance.now();
    const from = v ? 0 : 1;
    const to = v ? 1 : 0;

    const step = (now: number) => {
      if (pageHidden) {
        requestAnimationFrame(step);
        return;
      }
      const p = clamp01((now - start) / dur);
      const k = Ease.springSnappy(p);
      const t = from + (to - from) * k; // 0 → 1 open
      const angle = 180 * t;

      front.style.transform = `rotateY(${-angle}deg)`;
      back.style.transform = `rotateY(${180 - angle}deg)`;
      front.style.filter = `brightness(${1 - 0.1 * t})`;
      back.style.filter = `brightness(${0.9 + 0.1 * t})`;

      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const handle: FoldHandle = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!openState),
    destroy: () => {
      // reset
      front.style.transform = "";
      back.style.transform = "rotateY(180deg)";
      root.style.perspective = "";
      root.style.transformStyle = "";
      root.style.willChange = "";
    },
  };

  // init back face hidden by default
  back.style.transform = "rotateY(180deg)";
  return handle;
}

/* =======================================================================================
 * 8) Small Helpers (timed class toggles, scroll lock for modals)
 * ======================================================================================= */

export function timedClass(el: HTMLElement, cls: string, ms = 300) {
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

export function lockScroll(lock: boolean) {
  if (!isBrowser) return;
  document.documentElement.style.overflow = lock ? "hidden" : "";
}

/* =======================================================================================
 * 9) Demo: High-level “pulse on filter change”
 * ======================================================================================= */

export function pulseWaterlineOnFilter(waterline: WaterlineHandle | undefined) {
  if (!waterline || prefersReducedMotion()) return;
  waterline.pulse(1.0);
}

/* =======================================================================================
 * 10) Public Facade
 * ======================================================================================= */

export const Effects = {
  // motion state
  prefersReducedMotion,

  // primitives
  Ease,
  countUp,

  // waterline
  initWaterline,

  // portal
  playPortal,

  // orbit
  startOrbit,

  // ripple
  bindGlobalRipple,

  // fold
  mountFold,

  // helpers
  timedClass,
  lockScroll,
  pulseWaterlineOnFilter,
};
