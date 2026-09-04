import React, { useEffect, useRef, useState } from "react";
import { useCameraStream } from "../hooks/useCameraStream.js";
import { lookupBarcode } from "../utils/foodBarcodeLookup.js";

// ZXing (barcode decoding) is a sizeable library — dynamically imported so it only loads when
// someone actually opens the barcode scanner, not as part of the app's main bundle.
async function loadZxing() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  const hints = new Map();
  // Retail packaging formats (spec: "UPC-A, UPC-E, EAN-13, EAN-8 and other appropriate common
  // retail formats") — CODE_128 and ITF cover most remaining grocery/shipping cases.
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.ITF]);
  return new BrowserMultiFormatReader(hints);
}

// Real camera + real multi-format barcode decoding (ZXing — works in Safari/iOS via canvas
// frame sampling, not the native Shape Detection API, which Safari doesn't implement). Section
// 1-3 of the scan-food spec, end to end: open camera -> detect -> stop -> look up -> show
// result, with an honest "we don't have this product" path and manual-entry escape hatches at
// every failure point so the user is never trapped behind a broken camera.
export default function BarcodeScannerScreen({ state, updateState, onNavigate, onScanLabelForBarcode, onManualEntry }) {
  const { videoRef, stream, status, errorMessage, start, stop } = useCameraStream();
  const [step, setStep] = useState("scanning"); // "scanning" | "looking_up" | "found" | "notFound" | "lookupFailed"
  const [barcode, setBarcode] = useState(null);
  const [product, setProduct] = useState(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [showManualBarcode, setShowManualBarcode] = useState(false);
  const [editingServing, setEditingServing] = useState(false);
  const [saveToFoods, setSaveToFoods] = useState(false);

  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const decodedRef = useRef(false);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "streaming" || !stream || !videoRef.current || decodedRef.current) return;
    let cancelled = false;

    loadZxing()
      .then((reader) => {
        if (cancelled) return;
        readerRef.current = reader;
        return reader.decodeFromStream(stream, videoRef.current, (result) => {
          if (cancelled || decodedRef.current || !result) return;
          const text = result.getText();
          if (!text) return;
          decodedRef.current = true; // stop duplicate-scan re-triggers immediately
          controlsRef.current?.stop();
          stop();
          setBarcode(text);
          runLookup(text);
        });
      })
      .then((controls) => {
        if (!cancelled) controlsRef.current = controls;
        else controls?.stop();
      })
      .catch(() => {
        // Decoder failed to load/attach — camera preview still shows; user can fall back manually.
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stream]);

  const runLookup = async (code) => {
    setStep("looking_up");
    try {
      const result = await lookupBarcode(code);
      if (result.found) {
        setProduct(result);
        setStep("found");
      } else {
        setStep("notFound");
      }
    } catch (e) {
      setStep("lookupFailed");
    }
  };

  const logProduct = () => {
    if (!product) return;
    const entry = {
      food: [product.brand, product.name].filter(Boolean).join(" "),
      servingDesc: product.servingDesc,
      calories: product.calories || 0,
      protein: product.protein || 0,
      carbs: product.carbs || 0,
      fat: product.fat || 0,
      fiber: product.fiber || 0,
      barcode: product.barcode,
      source: "barcode",
    };
    updateState((prev) => ({
      ...prev,
      foodLogs: [{ id: `food_${Date.now()}`, date: new Date().toISOString().slice(0, 10), time: new Date().toISOString(), meal: "snack", ...entry }, ...(prev.foodLogs || [])],
      savedFoods: saveToFoods
        ? [{ id: `savedfood_${Date.now()}`, name: entry.food, servingDesc: entry.servingDesc, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, fiber: entry.fiber, barcode: entry.barcode, lastUsedAt: new Date().toISOString() }, ...(prev.savedFoods || [])]
        : prev.savedFoods,
    }));
    onNavigate("nutritionLog");
  };

  const submitManualBarcode = () => {
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    setBarcode(trimmed);
    runLookup(trimmed);
  };

  // Permission denied / unsupported / hard error — never trap the user behind a broken camera.
  // Only takes over while still on the live-scan step — once a manual barcode lookup is under
  // way (or has resolved), its own step-specific screen must win even though camera `status`
  // is still "denied"; otherwise a manual lookup after a permission denial can never actually
  // display its result.
  if ((status === "denied" || status === "unsupported" || status === "error") && step === "scanning") {
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
        <p className="text-sm text-v5-subtext">BRK needs camera access to scan food. {errorMessage}</p>
        <p className="text-xs text-v5-subtext/70">
          If you denied access, enable camera permission for this site in your browser or device settings, then try again.
        </p>
        <button onClick={start} className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
          Try Again
        </button>
        <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext">Enter barcode manually</label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="e.g. 8901030826501"
              className="flex-1 bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
            />
            <button onClick={submitManualBarcode} className="shrink-0 px-4 py-2 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
              Look Up
            </button>
          </div>
        </div>
        <button onClick={onManualEntry} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
          Enter Food Manually
        </button>
      </div>
    );
  }

  if (step === "found" && product) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
            <div className="text-xl font-bold text-white mt-1">Product Found</div>
          </div>
          <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            ← Back
          </button>
        </div>
        <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-3">
          <div>
            {product.brand && <div className="text-xs text-v5-subtext">{product.brand}</div>}
            <div className="text-lg font-bold text-white">{product.name}</div>
            <div className="text-[11px] text-v5-subtext/70 mt-1">Barcode: {product.barcode}</div>
          </div>
          <div className="text-xs text-v5-subtext">
            Serving: {product.servingDesc || (product.basis === "100g" ? "100g (per 100g, not per serving)" : "—")}
          </div>
          {editingServing ? (
            <EditServingForm product={product} onSave={(p) => { setProduct(p); setEditingServing(false); }} onCancel={() => setEditingServing(false)} />
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-base font-bold text-white">{product.calories ?? "—"}</div>
                  <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Calories</div>
                </div>
                <div>
                  <div className="text-base font-bold text-white">{product.protein ?? "—"}g</div>
                  <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Protein</div>
                </div>
                <div>
                  <div className="text-base font-bold text-white">{product.carbs ?? "—"}g</div>
                  <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Carbs</div>
                </div>
                <div>
                  <div className="text-base font-bold text-white">{product.fat ?? "—"}g</div>
                  <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Fat</div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-v5-subtext">
                <input type="checkbox" checked={saveToFoods} onChange={(e) => setSaveToFoods(e.target.checked)} />
                Save to My Foods for quick re-logging
              </label>
              <div className="flex gap-2">
                <button onClick={logProduct} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
                  Add Food
                </button>
                <button onClick={() => setEditingServing(true)} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
                  Edit Serving
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (step === "notFound") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
            <div className="text-xl font-bold text-white mt-1">We Scanned The Barcode</div>
          </div>
          <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            ← Back
          </button>
        </div>
        <div className="border border-amber-900/40 bg-v5-elevated p-4 space-y-2">
          <div className="text-sm text-v5-text/90">Barcode: {barcode}</div>
          <div className="text-sm text-amber-500">We don't have this product yet.</div>
        </div>
        <button onClick={() => onScanLabelForBarcode(barcode)} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
          Scan Nutrition Label
        </button>
        <button onClick={onManualEntry} className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
          Enter Manually
        </button>
      </div>
    );
  }

  if (step === "lookupFailed") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
            <div className="text-xl font-bold text-white mt-1">Couldn't Look That Up</div>
          </div>
          <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            ← Back
          </button>
        </div>
        <p className="text-sm text-v5-subtext">We scanned barcode {barcode}, but couldn't reach the product database. Check your connection and try again.</p>
        <button onClick={() => runLookup(barcode)} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
          Try Again
        </button>
        <button onClick={() => onScanLabelForBarcode(barcode)} className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
          Scan Nutrition Label Instead
        </button>
        <button onClick={onManualEntry} className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
          Enter Manually
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Scan Barcode</div>
        </div>
        <button
          onClick={() => onNavigate("nutrition")}
          className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red"
        >
          Cancel
        </button>
      </div>

      <div className="relative w-full aspect-[3/4] bg-black border border-white/10 overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[80%] aspect-[8/5] border-2 border-red-600">
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[11px] uppercase tracking-widest text-v5-red bg-black/60 px-2 py-1">Position Barcode Inside Frame</span>
            </div>
          </div>
        </div>
        {status === "requesting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="text-xs uppercase tracking-widest text-v5-subtext">Requesting camera access…</span>
          </div>
        )}
        {step === "looking_up" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <span className="text-xs uppercase tracking-widest text-white">Looking up {barcode}…</span>
          </div>
        )}
      </div>

      <p className="text-xs text-v5-subtext text-center">Hold your product's barcode steady inside the frame.</p>

      {showManualBarcode ? (
        <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext">Type the barcode number</label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="e.g. 8901030826501"
              className="flex-1 bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
            />
            <button onClick={submitManualBarcode} className="shrink-0 px-4 py-2 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
              Look Up
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowManualBarcode(true)} className="w-full py-2.5 text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red border border-white/10">
          Type Barcode Instead
        </button>
      )}
      <button onClick={onManualEntry} className="w-full py-2.5 text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red border border-white/10">
        Enter Food Manually
      </button>
    </div>
  );
}

function EditServingForm({ product, onSave, onCancel }) {
  const [calories, setCalories] = useState(product.calories ?? "");
  const [protein, setProtein] = useState(product.protein ?? "");
  const [carbs, setCarbs] = useState(product.carbs ?? "");
  const [fat, setFat] = useState(product.fat ?? "");
  const [servingDesc, setServingDesc] = useState(product.servingDesc || "");

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={servingDesc}
        onChange={(e) => setServingDesc(e.target.value)}
        placeholder="Serving description"
        className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
      />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Calories" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ ...product, servingDesc, calories: Number(calories) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 })}
          className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
        >
          Save
        </button>
        <button onClick={onCancel} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
          Cancel
        </button>
      </div>
    </div>
  );
}
