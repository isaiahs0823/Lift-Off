import React, { useState } from "react";
import { Calculator, Minus, RotateCcw } from "lucide-react";
import { PLATE_SIZES, BAR_WEIGHT_OPTIONS, emptyStack, addPlatePair, removePlatePair, totalFromStack, stackToList } from "../utils/plateMath.js";

// Tap-to-build plate calculator — the athlete builds the bar the way they'd actually load it
// (tap a plate size, it's added to BOTH sides at once) rather than typing a target weight and
// being told which plates to use. Bar weight is local to this panel (defaults from the app-wide
// setting) since "Reset Plates" must clear only the loaded plates, never the selected bar.
export default function PlateCalculatorPanel({ barWeight: initialBarWeight, onUseWeight }) {
  const [barWeight, setBarWeight] = useState(initialBarWeight || 45);
  const [customBar, setCustomBar] = useState("");
  const [stack, setStack] = useState(emptyStack());

  const total = totalFromStack(barWeight, stack);
  const loaded = stackToList(stack);
  const isCustomBar = !BAR_WEIGHT_OPTIONS.includes(barWeight);

  return (
    <div className="border border-white/10 bg-v5-elevated p-4 space-y-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-v5-subtext">
        <Calculator size={12} /> Plate calculator
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext/70 mb-1.5">Bar weight</div>
        <div className="flex flex-wrap gap-1.5">
          {BAR_WEIGHT_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => {
                setBarWeight(w);
                setCustomBar("");
              }}
              className={`px-3 py-2 text-xs font-bold border ${
                barWeight === w ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              {w} lb
            </button>
          ))}
          <input
            type="number"
            inputMode="decimal"
            value={customBar}
            onChange={(e) => {
              setCustomBar(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== "" && !Number.isNaN(n)) setBarWeight(n);
            }}
            placeholder="Custom"
            className={`w-24 bg-v5-surface border px-2 py-2 text-xs text-v5-text focus:outline-none focus:border-v5-red ${
              isCustomBar ? "border-v5-red" : "border-white/10"
            }`}
          />
        </div>
      </div>

      <div className="text-center border border-white/10 bg-v5-surface py-4">
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext/70">Current load</div>
        <div className="text-5xl font-bold text-white tabular-nums mt-1">{total}</div>
        <div className="text-xs text-v5-subtext mt-0.5">lb · bar {barWeight} lb</div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext/70 mb-1.5">Tap to add a plate pair</div>
        <div className="grid grid-cols-3 gap-2">
          {PLATE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setStack((s) => addPlatePair(s, size))}
              className="py-3 text-base font-bold border border-white/10 text-white bg-v5-surface hover:border-v5-red active:bg-v5-red/30"
              aria-label={`Add ${size} lb plate pair`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {loaded.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext/70 mb-1.5">Per side</div>
          <div className="space-y-1.5">
            {loaded.map(({ size, pairs }) => (
              <div key={size} className="flex items-center justify-between border border-white/10 bg-v5-surface px-3 py-2">
                <span className="text-sm font-bold text-white">
                  {size} <span className="text-v5-subtext font-normal">× {pairs}</span>
                </span>
                <button
                  onClick={() => setStack((s) => removePlatePair(s, size))}
                  className="shrink-0 w-8 h-8 flex items-center justify-center border border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red"
                  aria-label={`Remove one ${size} lb plate pair`}
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setStack(emptyStack())}
          className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-text/90 hover:border-v5-red/40 flex items-center justify-center gap-1.5"
        >
          <RotateCcw size={12} /> Reset plates
        </button>
        {onUseWeight && (
          <button
            onClick={() => onUseWeight(total)}
            className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90"
          >
            Use {total} lb
          </button>
        )}
      </div>
    </div>
  );
}

// Collapsed by default so it doesn't compete for space with the actual logging flow — one tap
// reveals it. Kept as its own export (not folded into PlateCalculatorPanel) so callers that just
// want the toggle affordance don't have to think about the panel's internal state.
export function PlateCalculatorToggle({ barWeight, onUseWeight }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red"
      >
        <Calculator size={12} /> Plate calculator {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2">
          <PlateCalculatorPanel barWeight={barWeight} onUseWeight={onUseWeight} />
        </div>
      )}
    </div>
  );
}
