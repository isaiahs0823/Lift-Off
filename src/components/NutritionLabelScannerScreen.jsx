import React, { useEffect, useRef, useState } from "react";
import { useCameraStream } from "../hooks/useCameraStream.js";

const MAX_CAPTURE_WIDTH = 900;

function captureFrame(videoEl) {
  const scale = Math.min(1, MAX_CAPTURE_WIDTH / videoEl.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(videoEl.videoWidth * scale);
  canvas.height = Math.round(videoEl.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// Real camera capture of the printed Nutrition Facts panel (spec section 2). Deliberately does
// NOT attempt to auto-read the numbers: this app has no backend/vision endpoint to do that
// reliably, and guessing values from an unread label is explicitly the one thing this feature
// must never do. What this builds is the real pipeline up to that point — camera, capture,
// retake, a downscaled image ready to hand to a vision endpoint later — plus a mandatory,
// fully editable review screen so the athlete transcribes the label themselves with the photo
// right in front of them, and nothing is ever saved without their explicit confirmation.
export default function NutritionLabelScannerScreen({ updateState, onNavigate, pendingBarcode }) {
  const { videoRef, status, errorMessage, start, stop } = useCameraStream();
  const [captured, setCaptured] = useState(null); // data URL, or null while still live
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    if (!videoRef.current) return;
    const dataUrl = captureFrame(videoRef.current);
    setCaptured(dataUrl);
    stop();
  };

  const retake = () => {
    setCaptured(null);
    start();
  };

  if (status === "denied" || status === "unsupported" || status === "error") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
            <div className="text-xl font-bold text-white mt-1">Camera Access Required</div>
          </div>
          <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            ← Back
          </button>
        </div>
        <p className="text-sm text-v5-subtext">BRK needs camera access to scan a nutrition label. {errorMessage}</p>
        <p className="text-xs text-v5-subtext/70">Enable camera permission for this site in your browser or device settings, then try again.</p>
        <button onClick={start} className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
          Try Again
        </button>
        <button onClick={() => onNavigate("nutritionLog")} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
          Enter Food Manually
        </button>
      </div>
    );
  }

  if (captured && !reviewing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
            <div className="text-xl font-bold text-white mt-1">Review Photo</div>
          </div>
          <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            Cancel
          </button>
        </div>
        <img src={captured} alt="Captured nutrition label" className="w-full border border-white/10" />
        <div className="flex gap-2">
          <button onClick={() => setReviewing(true)} className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
            Continue
          </button>
          <button onClick={retake} className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
            Retake
          </button>
        </div>
      </div>
    );
  }

  if (reviewing) {
    return <ReviewNutritionForm image={captured} pendingBarcode={pendingBarcode} updateState={updateState} onNavigate={onNavigate} onRetake={() => { setReviewing(false); retake(); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Scan Nutrition Label</div>
        </div>
        <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
          Cancel
        </button>
      </div>

      <div className="relative w-full aspect-[3/4] bg-black border border-white/10 overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[85%] aspect-[3/4] border-2 border-red-600" />
        </div>
        {status === "requesting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="text-xs uppercase tracking-widest text-v5-subtext">Requesting camera access…</span>
          </div>
        )}
      </div>

      <p className="text-xs text-v5-subtext text-center">
        Fit the entire Nutrition Facts label inside the frame. Avoid glare. Keep text in focus.
      </p>

      <button
        onClick={capture}
        disabled={status !== "streaming"}
        className="w-full py-4 text-sm uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90 disabled:opacity-40"
      >
        Capture
      </button>
    </div>
  );
}

function ReviewNutritionForm({ image, pendingBarcode, updateState, onNavigate, onRetake }) {
  const [servingDesc, setServingDesc] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");

  const canSave = name.trim() && calories !== "";

  const save = () => {
    if (!canSave) return;
    const food = {
      id: `savedfood_${Date.now()}`,
      name: [brand.trim(), name.trim()].filter(Boolean).join(" "),
      servingDesc: servingDesc.trim() || null,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: Number(fiber) || 0,
      barcode: pendingBarcode || null,
      lastUsedAt: new Date().toISOString(),
    };
    updateState((prev) => ({ ...prev, savedFoods: [food, ...(prev.savedFoods || [])] }));
    onNavigate("nutritionLog");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Review Nutrition</div>
        </div>
        <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
          Cancel
        </button>
      </div>

      {image && <img src={image} alt="Captured nutrition label" className="w-full border border-white/10" />}

      <div className="border border-amber-900/40 bg-v5-elevated p-3 text-xs text-amber-500">
        Automatic label reading isn't connected yet — enter the values you see in the photo above. Every field is editable before you save.
      </div>

      {pendingBarcode && <div className="text-xs text-v5-subtext">Barcode {pendingBarcode} will be attached to this food.</div>}

      <div className="space-y-3">
        <Field label="Serving Size">
          <input type="text" value={servingDesc} onChange={(e) => setServingDesc(e.target.value)} placeholder="e.g. 1 cup (240ml)" className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories">
            <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="e.g. 150" className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />
          </Field>
          <Field label="Protein (g)">
            <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="e.g. 25" className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />
          </Field>
          <Field label="Carbs (g)">
            <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="e.g. 7" className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />
          </Field>
          <Field label="Fat (g)">
            <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="e.g. 2" className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />
          </Field>
        </div>
        <Field label="Fiber (g)" hint="Optional">
          <input type="number" value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="Optional" className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />
        </Field>
      </div>

      <div className="space-y-3 pt-2 border-t border-white/[0.06]">
        <Field label="Product Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Whey Protein" className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />
        </Field>
        <Field label="Brand" hint="Optional">
          <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Ghost" className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />
        </Field>
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={!canSave} className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90 disabled:opacity-40">
          Save Food
        </button>
        <button onClick={onRetake} className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
          Retake
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-v5-subtext/70 mt-1">{hint}</p>}
    </div>
  );
}
