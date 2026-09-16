import React, { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";

// Shared slide-in-from-the-right detail panel used for edit forms, swap pickers, and any
// other "drill into one thing" view across the app.
//
// `footer` (optional) is a persistent action bar — pass it when the panel ends in a primary
// decision (e.g. "Use This Workout Today") that must stay reachable without scrolling through
// the panel's content first (task: "BRK Workout Preview UX Bug"). It renders fixed above the
// app's bottom nav instead of inside the scrolling `children`, with the safe-area/nav-height
// offsets baked in here so every caller gets this for free. Every existing caller that doesn't
// pass `footer` is unaffected — same markup as before.
export function SlideInPanel({ title, subtitle, onBack, children, footer }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="overflow-hidden">
      <div className={`transform transition-transform duration-300 ease-out ${entered ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center gap-3 px-4 py-3 mb-4 border border-v5-red/25 bg-v5-elevated">
          <button onClick={onBack} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{title}</div>
            {subtitle && <div className="text-xs text-v5-subtext mt-0.5 truncate">{subtitle}</div>}
          </div>
        </div>
        {/* pb-36 reserves room below the last content row so it can scroll fully clear of the
            fixed footer instead of hiding underneath it. */}
        <div className={`space-y-4 ${footer ? "pb-36" : ""}`}>{children}</div>
      </div>
      {footer && (
        // bottom-[…] sits this bar immediately above the app's bottom nav at both its mobile
        // (~58px) and sm:/desktop (~62px) rendered heights, and rides up with it further on a
        // notched device via the same env(safe-area-inset-bottom) the nav itself adds — so the
        // two stay stacked, never overlapping, at any width or inset.
        <div
          className="fixed left-0 right-0 z-20 bottom-[calc(60px_+_env(safe-area-inset-bottom))] sm:bottom-[calc(64px_+_env(safe-area-inset-bottom))] bg-v5-bg/95 backdrop-blur-sm border-t border-white/10 px-4 pt-3 pb-3"
        >
          {footer}
        </div>
      )}
    </div>
  );
}
