import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";

// 5 lb increments up to 100, per spec — a native <select> is used for the amount picker rather
// than custom swipe/gesture handling: on mobile it opens the OS's own wheel/list picker (a real
// scroll-wheel on iOS), which is more reliable and accessible than reimplementing one, and it
// stays genuinely compact (one row) with no modal.
const ADJUST_AMOUNTS = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);

// Compact "load dial" — a single horizontal strip (-, amount, +) meant to sit directly under the
// live weight value inside the same weight card, so it reads as one integrated control rather
// than a separate bordered gadget bolted on beside the input. +/- apply the selected amount to
// the current draft weight; the amount itself is chosen from the middle selector. Purely a
// draft-weight helper — it only ever calls onChange with a new number, exactly like typing into
// the weight field would. It never saves a set, never touches the rest timer, and never reads or
// writes anything beyond the single weight value it's given.
export default function QuickLoadAdjuster({ weight, onChange, step = 5 }) {
  const [amount, setAmount] = useState(step);

  const apply = (sign) => {
    const current = Number(weight) || 0;
    const next = Math.max(0, current + sign * amount);
    onChange(next);
  };

  return (
    <div className="flex items-stretch justify-center w-full rounded-lg bg-v5-elevated divide-x divide-v5-muted overflow-hidden">
      <button
        onClick={() => apply(-1)}
        aria-label={`Subtract ${amount} lb`}
        className="flex items-center justify-center w-9 h-8 text-v5-subtext hover:text-v5-text active:bg-v5-muted"
      >
        <Minus size={14} />
      </button>
      <select
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        aria-label="Adjustment amount"
        className="flex-1 min-w-0 bg-transparent text-center text-xs font-bold text-v5-subtext focus:outline-none"
      >
        {ADJUST_AMOUNTS.map((a) => (
          <option key={a} value={a} className="bg-v5-elevated">
            ± {a}
          </option>
        ))}
      </select>
      <button
        onClick={() => apply(1)}
        aria-label={`Add ${amount} lb`}
        className="flex items-center justify-center w-9 h-8 text-v5-subtext hover:text-v5-text active:bg-v5-muted"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
