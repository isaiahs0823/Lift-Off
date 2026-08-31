import React, { useMemo, useState } from "react";
import { Share2, Download, X, Check } from "lucide-react";
import {
  SHARE_TEMPLATES,
  SHARE_SIZES,
  pickFeaturedLift,
  listFeaturableLifts,
  renderWorkoutShareCard,
} from "../utils/workoutShareCard.js";

// Full share preview flow for a completed workout (task: "Redesign the workout share/export
// feature"). Opened from a single "Share" button on Session Complete and Workout History Detail
// — both pass the exact same `session` shape (a workoutSessions entry), so this component is the
// one place that owns template/size/featured-lift choice and image generation for both surfaces.
//
// Renders are on-demand canvas draws (cheap — a few ms), recomputed whenever template/size/
// featured lift changes, so the preview always reflects the current selection with no separate
// "confirm" step before the image is ready to save/share.
export default function WorkoutSharePreview({ session, exMap, onClose }) {
  const [template, setTemplate] = useState("performance");
  const [sizeId, setSizeId] = useState("story");
  const autoFeatured = useMemo(() => pickFeaturedLift(session, exMap), [session, exMap]);
  const [featuredOverride, setFeaturedOverride] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const featurable = useMemo(() => listFeaturableLifts(session, exMap), [session, exMap]);
  const featured = featuredOverride || autoFeatured;
  const size = SHARE_SIZES.find((s) => s.id === sizeId) || SHARE_SIZES[0];

  const dataUrl = useMemo(() => {
    try {
      return renderWorkoutShareCard({ session, exMap, template, sizeId, featuredLift: featured });
    } catch (e) {
      return null;
    }
  }, [session, exMap, template, sizeId, featured]);

  const save = async () => {
    if (!dataUrl) return;
    const filename = `brk-lift-${template}-${sizeId}.png`;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "BRK - Lift", text: session.planName || "Workout" });
        return;
      }
    } catch (e) {
      // user cancelled the native share sheet, or it isn't really usable here — fall through
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const showFeaturedPicker = template !== "recap";

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md sm:mx-4 bg-charcoal-panel border border-neutral-800 sm:border max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-red-600 font-bold">Share Workout</div>
            <div className="text-sm text-neutral-400">{session.planName}</div>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-red-500">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
          {/* Live preview */}
          <div className="flex items-center justify-center bg-black/40 border border-neutral-900 py-4">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt="Share card preview"
                className="max-h-[46vh] w-auto object-contain"
                style={{ aspectRatio: `${size.width} / ${size.height}` }}
              />
            ) : (
              <div className="text-xs text-neutral-500 py-20">Preview unavailable</div>
            )}
          </div>

          {/* Template picker */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">Style</div>
            <div className="grid grid-cols-3 gap-1.5">
              {SHARE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`py-2.5 px-1.5 text-center border ${
                    template === t.id ? "border-red-700 bg-red-950/20 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Size picker */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">Export Size</div>
            <div className="grid grid-cols-3 gap-1.5">
              {SHARE_SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSizeId(s.id)}
                  className={`py-2 text-center border ${
                    sizeId === s.id ? "border-red-700 bg-red-950/20 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide">{s.label}</div>
                  <div className="text-[10px] text-neutral-500">{s.ratio}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Featured lift override */}
          {showFeaturedPicker && featurable.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Featured Lift</div>
                <button onClick={() => setPickerOpen((o) => !o)} className="text-[10px] uppercase tracking-widest text-red-500 hover:text-red-400">
                  {pickerOpen ? "Close" : "Change"}
                </button>
              </div>
              <div className="border border-neutral-800 px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{featured?.name || "—"}</div>
                  <div className="text-xs text-neutral-500">
                    {featured?.weight != null ? `${featured.weight} × ${featured.reps}` : ""} {featured?.isPR ? "· PR" : ""}
                    {!featuredOverride && " · Auto-selected"}
                  </div>
                </div>
                {featuredOverride && (
                  <button
                    onClick={() => setFeaturedOverride(null)}
                    className="shrink-0 text-[10px] uppercase tracking-widest text-neutral-500 hover:text-red-500"
                  >
                    Reset
                  </button>
                )}
              </div>
              {pickerOpen && (
                <div className="mt-1.5 border border-neutral-800 divide-y divide-neutral-900 max-h-48 overflow-y-auto">
                  {featurable.map((lift) => (
                    <button
                      key={lift.exId}
                      onClick={() => {
                        setFeaturedOverride(lift);
                        setPickerOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-neutral-900"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-white flex items-center gap-1.5 min-w-0">
                          <span className="truncate min-w-0">{lift.name}</span>
                          {lift.isPR && <span className="shrink-0 text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5">PR</span>}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {lift.weight} × {lift.reps}
                        </div>
                      </div>
                      {featured?.exId === lift.exId && <Check size={16} className="text-red-500 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-neutral-900 shrink-0">
          <button
            onClick={save}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold bg-red-700 border border-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-1.5"
          >
            {typeof navigator !== "undefined" && navigator.share ? <Share2 size={14} /> : <Download size={14} />}
            {typeof navigator !== "undefined" && navigator.share ? "Share" : "Save Image"}
          </button>
          <button onClick={onClose} className="px-5 py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
