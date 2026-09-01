import React from "react";
import { ChevronRight } from "lucide-react";

// ---------------- BRK SHARED DESIGN SYSTEM ----------------
// Reusable primitives for the app-wide premium redesign. Everything here is built on the v5
// token palette already defined in tailwind.config.js (v5-bg/surface/elevated/muted, v5-text/
// subtext, v5-red/red-dim, v5-success) — the same palette TrainTab/GuidedRunView/
// TrainingExerciseCard already use. Promoting it here (rather than inventing a second palette)
// is what makes "BRK, just upgraded" true: the workout screens already look like this, the rest
// of the app is now catching up to match.
//
// Cards deliberately skip borders in favor of background-layer separation (surface sitting on
// bg, elevated sitting on surface) — flat bordered boxes read as "builder/prototype"; layered
// dark surfaces read as a native premium app. Red is reserved for CTAs, active state, and
// accents — never used as a decorative fill.

// ---- layout ----

// Small uppercase red/gray label used above a title or to open a section ("TRAIN", "TODAY",
// "PR HIGHLIGHTS"). tone: "red" (default, primary section marker) | "muted" (secondary grouping).
export function SectionLabel({ children, tone = "red", className = "" }) {
  return (
    <div
      className={`text-[11px] font-bold uppercase tracking-[0.16em] ${tone === "red" ? "text-v5-red" : "text-v5-subtext"} ${className}`}
    >
      {children}
    </div>
  );
}

// Top-of-screen title block — eyebrow + large headline + optional subtitle/support text, with an
// optional right-aligned slot for a single action. Every top-level screen (Today, Train,
// Programs, Progress, More) opens with one of these so screen identity is always presented the
// same way.
export function ScreenHeader({ eyebrow, title, subtitle, right, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
        {/* No truncate here — a screen title is short-lived, single-line text in the common
            case, but "Browse everything" next to a "Create plan" action showed why hard
            truncation is the wrong default: it clipped to "Browse everyth…" for no reason.
            Wrapping to a second line reads fine and never loses words. */}
        <div className="text-2xl font-black text-v5-text tracking-tight mt-1">{title}</div>
        {subtitle && <div className="text-sm text-v5-subtext mt-1">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// ---- cards ----

const CARD_TONE = {
  // Default surface card — the workhorse. One layer above the page background.
  default: "bg-v5-surface",
  // One layer up again — for a card that should read as slightly more prominent without going
  // all the way to the red-accented "hero" treatment (e.g. an already-elevated nested block).
  raised: "bg-v5-elevated",
  // Subtle red wash + soft ring — today's workout, an active program, a PR callout. Reserved for
  // the one or two things per screen that should visually lead.
  accent: "bg-gradient-to-b from-v5-red/[0.10] to-v5-surface ring-1 ring-v5-red/25",
  // Fully transparent, no background — for a row that lives inside another card's padding.
  flat: "bg-transparent",
};

// Base card shell. Pass `onClick` to make it an interactive button (adds hover feedback and a
// pointer cursor) — omit it for a static content card.
export function Card({ children, tone = "default", onClick, className = "", padding = "p-4", as }) {
  const base = `${padding} rounded-2xl text-left transition-colors ${CARD_TONE[tone] || CARD_TONE.default}`;
  const interactive = onClick ? "w-full hover:bg-v5-elevated active:opacity-90" : "";
  const Comp = as || (onClick ? "button" : "div");
  return (
    <Comp onClick={onClick} className={`${base} ${interactive} ${className}`}>
      {children}
    </Comp>
  );
}

// The one big focal card per screen (Today's workout, Train's current program). Larger padding,
// accent tone by default, room for a headline + a couple of stat lines + a CTA.
export function HeroCard({ children, className = "", tone = "accent" }) {
  return <Card tone={tone} padding="p-5 sm:p-6" className={`space-y-3 ${className}`}>{children}</Card>;
}

// ---- buttons ----

const BTN_SIZE = {
  sm: "py-2 px-4 text-[11px]",
  md: "py-3 px-5 text-xs",
  lg: "py-4 px-6 text-sm",
};

// Solid red, white text — the one primary action per screen/card ("Start Workout," "Save Set").
// `fullWidth` defaults to true (the common case — one CTA spanning its container); pass `false`
// for an inline button that should size to its content (e.g. sitting next to another button).
export function ButtonPrimary({ children, size = "md", className = "", icon: Icon, fullWidth = true, ...props }) {
  return (
    <button
      {...props}
      className={`${fullWidth ? "w-full" : ""} rounded-xl font-bold uppercase tracking-widest bg-v5-red text-white shadow-[0_8px_24px_-8px_rgba(210,38,46,0.55)] hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 ${BTN_SIZE[size]} ${className}`}
    >
      {Icon && <Icon size={size === "lg" ? 18 : 14} />}
      {children}
    </button>
  );
}

// Dark elevated fill, subtle border — secondary actions that still deserve a real tap target
// ("Discard workout," "Change"). Same `fullWidth` convention as ButtonPrimary.
export function ButtonSecondary({ children, size = "md", className = "", icon: Icon, fullWidth = true, ...props }) {
  return (
    <button
      {...props}
      className={`${fullWidth ? "w-full" : ""} rounded-xl font-bold uppercase tracking-widest bg-v5-elevated text-v5-text border border-white/10 hover:bg-v5-muted active:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2 ${BTN_SIZE[size]} ${className}`}
    >
      {Icon && <Icon size={size === "lg" ? 18 : 14} />}
      {children}
    </button>
  );
}

// Text-only — red for a meaningful-but-not-primary action, muted gray for a quiet/tertiary one.
export function ButtonText({ children, tone = "red", className = "", icon: Icon, ...props }) {
  return (
    <button
      {...props}
      className={`text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 ${
        tone === "red" ? "text-v5-red hover:opacity-80" : "text-v5-subtext hover:text-v5-text"
      } ${className}`}
    >
      {Icon && <Icon size={12} />}
      {children}
    </button>
  );
}

// ---- content primitives ----

// A single stat value + label, for a stat row inside a card (2-4 across).
export function StatTile({ value, label, className = "", valueClassName = "" }) {
  return (
    <div className={className}>
      <div className={`text-lg font-black text-v5-text tabular-nums ${valueClassName}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-v5-subtext mt-0.5">{label}</div>
    </div>
  );
}

// Standalone metric card for a stats dashboard (Progress screen) — bigger than StatTile, its own
// card surface, optionally tappable to drill in.
export function MetricTile({ value, label, sublabel, onClick, accent = false, className = "" }) {
  return (
    <Card onClick={onClick} padding="p-4" className={`space-y-1 ${className}`} tone={accent ? "accent" : "default"}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-v5-subtext">{label}</div>
      <div className="text-2xl font-black text-v5-text tabular-nums leading-none">{value}</div>
      {sublabel && <div className="text-xs text-v5-subtext">{sublabel}</div>}
    </Card>
  );
}

// Small rounded chip — status badges ("Current," "PR," "Complete") and filter/category chips.
// tone: "solid" (filled red, for badges) | "active" (filter chip currently selected) |
// "inactive" (filter chip not selected).
export function Pill({ children, tone = "solid", className = "" }) {
  const styles = {
    solid: "bg-v5-red text-white",
    active: "bg-v5-red text-white",
    inactive: "bg-v5-elevated text-v5-subtext",
    outline: "border border-v5-red/50 text-v5-red",
  };
  return (
    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${styles[tone]} ${className}`}>
      {children}
    </span>
  );
}

// The icon + title/subtitle + chevron row used for every navigation list item app-wide (More's
// tool list, Train's Programs/Cardio cards, Programs' browse rows). `right` overrides the
// trailing chevron with custom content (a Pill, a delta) when needed.
export function ListRow({ icon: Icon, title, subtitle, onClick, right, tone = "default", className = "" }) {
  return (
    <Card onClick={onClick} tone={tone} className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="shrink-0 w-9 h-9 rounded-full bg-v5-elevated flex items-center justify-center">
            <Icon size={16} className="text-v5-subtext" />
          </span>
        )}
        <div className="min-w-0 text-left">
          <div className="text-sm font-bold text-v5-text truncate">{title}</div>
          {subtitle && <div className="text-xs text-v5-subtext truncate mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {right !== undefined ? right : onClick && <ChevronRight size={16} className="text-v5-subtext shrink-0" />}
    </Card>
  );
}

// Thin fill bar — mission/goal progress, workout progress, adherence.
export function ProgressBar({ pct, className = "", trackClassName = "", barClassName = "" }) {
  const clamped = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className={`h-1.5 bg-v5-muted rounded-full overflow-hidden ${className} ${trackClassName}`}>
      <div className={`h-full bg-v5-red rounded-full transition-all ${barClassName}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

// Quiet placeholder for a section with nothing in it yet — icon, one line of copy, optional
// action. Replaces ad-hoc "text-neutral-500, no border" empty text scattered around the app.
export function EmptyState({ icon: Icon, title, body, action, className = "" }) {
  return (
    <div className={`text-center py-8 px-4 ${className}`}>
      {Icon && <Icon size={22} className="text-v5-subtext/50 mx-auto mb-2" />}
      {title && <div className="text-sm font-bold text-v5-text">{title}</div>}
      {body && <div className="text-xs text-v5-subtext mt-1 max-w-xs mx-auto">{body}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// Icon-over-label quick-action tile (Today's "Quick actions" row) — a lighter-weight tap target
// than a full ListRow/Button for a grid of 3-4 short actions.
export function ActionTile({ icon: Icon, label, onClick, className = "" }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 py-3 rounded-2xl bg-v5-surface hover:bg-v5-elevated ${className}`}>
      <span className="w-10 h-10 rounded-full bg-v5-elevated flex items-center justify-center">
        <Icon size={18} className="text-v5-red" />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-v5-subtext text-center leading-tight">{label}</span>
    </button>
  );
}

export function Divider({ className = "" }) {
  return <div className={`h-px bg-white/[0.06] ${className}`} />;
}

// ---------------- data viz ----------------

// Circular progress ring — readiness score, adherence %, any "N out of 100" or "N%" metric that
// deserves more visual weight than a plain number (Progress dashboard, Today's readiness card).
// Pure SVG, no chart library. `tone` recolors the ring independent of the numeric value (e.g.
// green/yellow/red readiness bands) — defaults to the brand red.
const RING_TONE = { red: "#D2262E", success: "#29C17E", warn: "#f59e0b", subtle: "#5b5f66" };
export function RingGauge({ pct, size = 76, strokeWidth = 7, tone = "red", label, value, sublabel, className = "" }) {
  const clamped = Math.max(0, Math.min(100, pct ?? 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2D31" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={RING_TONE[tone] || RING_TONE.red}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        </svg>
        {value != null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black text-v5-text tabular-nums">{value}</span>
          </div>
        )}
      </div>
      {(label || sublabel) && (
        <div className="min-w-0">
          {label && <div className="text-xs font-bold text-v5-text truncate">{label}</div>}
          {sublabel && <div className="text-[11px] text-v5-subtext truncate mt-0.5">{sublabel}</div>}
        </div>
      )}
    </div>
  );
}

// Tiny Mon-Sun (or any N-bar) bar chart — weekly volume, weekly sets. Each bar's height is
// relative to the tallest value in the set; a day with no value renders as a bare baseline dot
// rather than an empty gap, so a quiet week still reads as 7 real days, not missing data.
export function MiniBarChart({ bars, height = 56, className = "" }) {
  const max = Math.max(1, ...bars.map((b) => b.value || 0));
  return (
    <div className={`flex items-end justify-between gap-1.5 ${className}`} style={{ height }}>
      {bars.map((b, i) => {
        const h = b.value > 0 ? Math.max(4, Math.round((b.value / max) * (height - 16))) : 2;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`w-full rounded-full ${b.active ? "bg-v5-red" : "bg-v5-elevated"}`}
              style={{ height: h }}
            />
            <span className={`text-[9px] font-bold ${b.active ? "text-v5-red" : "text-v5-subtext/60"}`}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}
