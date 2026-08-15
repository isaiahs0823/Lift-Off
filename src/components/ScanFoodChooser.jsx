import React from "react";
import { Barcode, Camera } from "lucide-react";

// Entry point for real camera-based food scanning (spec sections 1/6). One deliberate choice
// up front — scan a barcode, or photograph the printed Nutrition Facts panel — since they're
// genuinely different capture flows, not two options on one screen.
export default function ScanFoodChooser({ onNavigate }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Scan Food</div>
        </div>
        <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
          ← Back
        </button>
      </div>

      <p className="text-sm text-neutral-400">What are you scanning?</p>

      <button
        onClick={() => onNavigate("nutritionScanBarcode")}
        className="w-full text-left border border-neutral-800 bg-charcoal-panel p-5 flex items-center gap-4 hover:border-red-700"
      >
        <Barcode size={28} className="text-red-500 shrink-0" />
        <div>
          <div className="text-base font-bold text-white">Barcode</div>
          <div className="text-xs text-neutral-500 mt-0.5">Scan the UPC/EAN barcode on packaged food</div>
        </div>
      </button>

      <button
        onClick={() => onNavigate("nutritionScanLabel")}
        className="w-full text-left border border-neutral-800 bg-charcoal-panel p-5 flex items-center gap-4 hover:border-red-700"
      >
        <Camera size={28} className="text-red-500 shrink-0" />
        <div>
          <div className="text-base font-bold text-white">Nutrition Label</div>
          <div className="text-xs text-neutral-500 mt-0.5">Photograph the printed Nutrition Facts panel</div>
        </div>
      </button>
    </div>
  );
}
