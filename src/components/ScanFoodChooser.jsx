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
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Scan Food</div>
        </div>
        <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
          ← Back
        </button>
      </div>

      <p className="text-sm text-v5-subtext">What are you scanning?</p>

      <button
        onClick={() => onNavigate("nutritionScanBarcode")}
        className="w-full text-left border border-white/10 bg-v5-elevated p-5 flex items-center gap-4 hover:border-v5-red"
      >
        <Barcode size={28} className="text-v5-red shrink-0" />
        <div>
          <div className="text-base font-bold text-white">Barcode</div>
          <div className="text-xs text-v5-subtext mt-0.5">Scan the UPC/EAN barcode on packaged food</div>
        </div>
      </button>

      <button
        onClick={() => onNavigate("nutritionScanLabel")}
        className="w-full text-left border border-white/10 bg-v5-elevated p-5 flex items-center gap-4 hover:border-v5-red"
      >
        <Camera size={28} className="text-v5-red shrink-0" />
        <div>
          <div className="text-base font-bold text-white">Nutrition Label</div>
          <div className="text-xs text-v5-subtext mt-0.5">Photograph the printed Nutrition Facts panel</div>
        </div>
      </button>
    </div>
  );
}
