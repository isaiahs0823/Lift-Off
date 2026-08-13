import React, { useState } from "react";
import { Share2, Download, X } from "lucide-react";

// Generates a branded share card image on demand (buildDataUrl is only called when the user
// actually taps Share, since canvas rendering is wasted work otherwise) and previews it in a
// simple overlay with Save/Share actions. Tries the native share sheet (Web Share API with a
// file) first on platforms that support it, falls back to a plain download otherwise.
export default function ShareCardButton({ buildDataUrl, filename = "brk-lift-share.png", label = "Share" }) {
  const [preview, setPreview] = useState(null);

  const open = () => {
    try {
      setPreview(buildDataUrl());
    } catch (e) {
      // canvas unavailable or generation failed — silently no-op rather than break the page
    }
  };

  const save = async () => {
    if (!preview) return;
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "BRK - Lift" });
        return;
      }
    } catch (e) {
      // user cancelled the share sheet, or the API isn't really usable here — fall through
    }
    const a = document.createElement("a");
    a.href = preview;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      <button onClick={open} className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500">
        <Share2 size={12} /> {label}
      </button>
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="max-w-xs w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <img src={preview} alt="Share card preview" className="w-full border border-neutral-800" />
            <div className="flex gap-2">
              <button
                onClick={save}
                className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-1.5"
              >
                <Download size={14} /> Save image
              </button>
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
