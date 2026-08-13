import React, { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";

// Shared slide-in-from-the-right detail panel used for edit forms, swap pickers, and any
// other "drill into one thing" view across the app.
export function SlideInPanel({ title, subtitle, onBack, children }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="overflow-hidden">
      <div className={`transform transition-transform duration-300 ease-out ${entered ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center gap-3 px-4 py-3 mb-4 border border-red-900/40 bg-charcoal-panel">
          <button onClick={onBack} className="text-neutral-400 hover:text-red-500 p-1 -ml-1 shrink-0" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{title}</div>
            {subtitle && <div className="text-xs text-neutral-500 mt-0.5 truncate">{subtitle}</div>}
          </div>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}
