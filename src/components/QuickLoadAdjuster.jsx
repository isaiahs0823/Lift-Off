import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";

// 5 lb increments up to 100, per spec — a native <select> is used for the amount picker rather
// than custom swipe/gesture handling: on mobile it opens the OS's own wheel/list picker (a real
// scroll-wheel on iOS), which is more reliable and accessible than reimplementing one, and it
// stays genuinely compact (one row) with no modal.
const ADJUST_AMOUNTS = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);

// Compact "load dial" beside the live weight field: +/- apply the selected amount to the
// current draft weight; the amount itself is chosen from the middle selector. Purely a draft-
// weight helper — it only ever calls onChange with a new number, exactly like typing into the
// weight field would. It never saves a set, never touches the rest timer, and never reads or
// writes anything beyond the single weight value it's given.
export default function QuickLoadAdjuster({ weight, onChange, step = 5 }) {
  const [amount, setAmount] = useState(step);

  const apply = (sign) => {
    const current = Number(weight) || 0;
    const next = Math.max(0, current + sign * amount);
    onChange(next);
  };

  return (
    <div className="flex flex-col items-stretch w-16 shrink-0 border border-neutral-800 bg-charcoal-deep">
      <button
        onClick={() => apply(1)}
        aria-label={`Add ${amount} lb`}
        className="flex-1 flex items-center justify-center py-2 text-white hover:bg-red-950/30 active:bg-red-950/50 border-b border-neutral-800"
      >
        <Plus size={18} />
      </button>
      <select
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        aria-label="Adjustment amount"
        className="w-full bg-transparent text-center text-sm font-bold text-neutral-300 py-1.5 focus:outline-none border-b border-neutral-800"
      >
        {ADJUST_AMOUNTS.map((a) => (
          <option key={a} value={a} className="bg-charcoal-panel">
            {a}
          </option>
        ))}
      </select>
      <button
        onClick={() => apply(-1)}
        aria-label={`Subtract ${amount} lb`}
        className="flex-1 flex items-center justify-center py-2 text-white hover:bg-red-950/30 active:bg-red-950/50"
      >
        <Minus size={18} />
      </button>
    </div>
  );
}
