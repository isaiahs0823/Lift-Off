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
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-neutral-500">
        <Calculator size={12} /> Plate calculator
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1.5">Bar weight</div>
        <div className="flex flex-wrap gap-1.5">
          {BAR_WEIGHT_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => {
                setBarWeight(w);
                setCustomBar("");
              }}
              className={`px-3 py-2 text-xs font-bold border ${
                barWeight === w ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
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
            className={`w-24 bg-charcoal-deep border px-2 py-2 text-xs text-neutral-100 focus:outline-none focus:border-red-700 ${
              isCustomBar ? "border-red-700" : "border-neutral-800"
            }`}
          />
        </div>
      </div>

      <div className="text-center border border-neutral-800 bg-charcoal-deep py-4">
        <div className="text-[10px] uppercase tracking-widest text-neutral-600">Current load</div>
        <div className="text-5xl font-bold text-white tabular-nums mt-1">{total}</div>
        <div className="text-xs text-neutral-500 mt-0.5">lb · bar {barWeight} lb</div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1.5">Tap to add a plate pair</div>
        <div className="grid grid-cols-3 gap-2">
          {PLATE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setStack((s) => addPlatePair(s, size))}
              className="py-3 text-base font-bold border border-neutral-700 text-white bg-charcoal-deep hover:border-red-700 active:bg-red-950/30"
              aria-label={`Add ${size} lb plate pair`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {loaded.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1.5">Per side</div>
          <div className="space-y-1.5">
            {loaded.map(({ size, pairs }) => (
              <div key={size} className="flex items-center justify-between border border-neutral-800 bg-charcoal-deep px-3 py-2">
                <span className="text-sm font-bold text-white">
                  {size} <span className="text-neutral-500 font-normal">× {pairs}</span>
                </span>
                <button
                  onClick={() => setStack((s) => removePlatePair(s, size))}
                  className="shrink-0 w-8 h-8 flex items-center justify-center border border-neutral-700 text-neutral-300 hover:border-red-700 hover:text-red-500"
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
          className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-300 hover:border-neutral-600 flex items-center justify-center gap-1.5"
        >
          <RotateCcw size={12} /> Reset plates
        </button>
        {onUseWeight && (
          <button
            onClick={() => onUseWeight(total)}
            className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
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
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500"
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
