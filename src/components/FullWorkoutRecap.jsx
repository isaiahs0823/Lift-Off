import React, { useMemo, useState } from "react";
import { X, Check, Copy, Share2, Image as ImageIcon, ChevronDown, ChevronUp, Award } from "lucide-react";
import { buildFullRecapData, buildFullRecapText } from "../utils/fullRecap.js";
import { renderFullRecapImage } from "../utils/workoutShareCard.js";
import { PR_TYPE_LABEL, prDeltaLabel, prPreviousLabel } from "../utils/prSummary.js";

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
function fmtTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// One logged set as a dense report row. Drop sequences render as their own indented arrow lines
// (task section 4: "do not flatten this into one fake set") rather than one run-on string.
function SetRow({ row }) {
  const badges = [];
  if (row.setType !== "working" && row.setType !== "warmup") badges.push({ text: row.setTypeLabel.toUpperCase(), tone: "neutral" });
  if (row.qualityLabel) badges.push({ text: row.qualityLabel.toUpperCase(), tone: row.quality === "pain" || row.quality === "form_breakdown" ? "warn" : "neutral" });
  if (row.prs.length > 0) badges.push({ text: "PR", tone: "pr" });

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 ${row.isWarmup ? "opacity-70" : ""}`}>
      <span className="text-[10px] uppercase tracking-widest text-v5-subtext/60 w-9 shrink-0">
        {row.isWarmup ? "Warm" : `#${row.index}`}
      </span>
      <span className="text-sm font-bold text-white">
        {row.weight} × {row.reps}
      </span>
      {(row.rir != null || row.rpe != null) && (
        <span className="text-xs text-v5-subtext">{row.rir != null ? `RIR ${row.rir}` : `RPE ${row.rpe}`}</span>
      )}
      {badges.map((b, i) => (
        <span
          key={i}
          className={`text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
            b.tone === "pr" ? "bg-v5-red text-white" : b.tone === "warn" ? "bg-v5-red/15 text-v5-red" : "bg-white/10 text-v5-subtext"
          }`}
        >
          {b.text}
        </span>
      ))}
      {row.pain?.bodyArea && <span className="text-[11px] text-v5-red">{row.pain.bodyArea}{row.pain.severity != null ? ` ${row.pain.severity}/10` : ""}</span>}
      {row.drops.length > 0 && (
        <div className="w-full pl-9 space-y-0.5">
          {row.drops.map((d, i) => (
            <div key={i} className="text-sm text-v5-text/80">
              <span className="text-v5-subtext/60">→</span> {d.weight} × {d.reps}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseBlock({ ex, index }) {
  const [collapsed, setCollapsed] = useState(false);
  const warmups = ex.setRows.filter((r) => r.isWarmup);
  const working = ex.setRows.filter((r) => !r.isWarmup);
  const hasPR = ex.prs.length > 0;

  return (
    <div className={`border ${hasPR ? "border-v5-red/30" : "border-white/10"} bg-v5-elevated`}>
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-start justify-between gap-2 p-4 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-black text-v5-subtext/50 shrink-0">{String(index + 1).padStart(2, "0")}</span>
            <span className="text-base font-bold text-white truncate">{ex.name}</span>
            {hasPR && <span className="shrink-0 text-[10px] uppercase tracking-widest font-bold bg-v5-red text-white px-1.5 py-0.5 rounded">PR</span>}
          </div>
          {ex.equipmentLabel && <div className="text-[11px] text-v5-subtext mt-0.5 ml-6">{ex.equipmentLabel}</div>}
          {ex.targetReps != null && <div className="text-[11px] text-v5-subtext/70 mt-0.5 ml-6">Target: {ex.targetReps} reps</div>}
        </div>
        {collapsed ? <ChevronDown size={16} className="text-v5-subtext/70 shrink-0 mt-1" /> : <ChevronUp size={16} className="text-v5-subtext/70 shrink-0 mt-1" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {ex.prs.length > 0 && (
            <div className="border border-v5-red/30 bg-v5-red/10 rounded-lg p-3 space-y-1.5">
              {ex.prs.map((pr, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-white uppercase tracking-wide text-[11px]">{PR_TYPE_LABEL[pr.type]}</span>
                  <span className="text-v5-subtext text-xs">
                    Previous: {prPreviousLabel(pr)} <span className="text-green-500 font-bold">{prDeltaLabel(pr)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {warmups.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-v5-subtext/60 font-bold mb-0.5">Warm-up</div>
              <div className="divide-y divide-white/[0.04]">
                {warmups.map((r) => (
                  <SetRow key={r.index} row={r} />
                ))}
              </div>
            </div>
          )}

          {working.length > 0 && (
            <div>
              {warmups.length > 0 && <div className="text-[10px] uppercase tracking-widest text-v5-subtext/60 font-bold mb-0.5">Working</div>}
              <div className="divide-y divide-white/[0.04]">
                {working.map((r) => (
                  <SetRow key={r.index} row={r} />
                ))}
              </div>
            </div>
          )}

          {ex.jointNote && (
            <div className="text-xs text-v5-red border-t border-white/[0.06] pt-2">
              {ex.jointNote.bodyArea ? `${ex.jointNote.bodyArea} discomfort` : "Discomfort noted"}
              {ex.jointNote.severity != null ? `: ${ex.jointNote.severity}/10` : ""}
              {ex.jointNote.note ? ` — ${ex.jointNote.note}` : ""}
            </div>
          )}

          {ex.workingSetCount > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-widest text-v5-subtext border-t border-white/[0.06] pt-2.5">
              <span className="font-bold text-white">{ex.workingSetCount} working set{ex.workingSetCount === 1 ? "" : "s"}</span>
              <span>{ex.workingReps} reps</span>
              <span>{ex.volume.toLocaleString()} lb</span>
              {ex.bestSet && (
                <span>
                  Best: <span className="text-white font-bold">{ex.bestSet.weight} × {ex.bestSet.reps}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The complete workout record (task: "BRK FULL RECAP REBUILD"). Categorically different from the
// Performance/Minimal Story share posters — no fixed canvas size, no featured-lift curation, no
// cap on exercises. Every exercise, every set, warm-ups distinguished, drop sequences preserved,
// equipment context, PRs, notes, and pain flags all shown so the athlete can hand this to an
// outside coach or another AI without any other screenshot (task's own "final product test").
// Rendered as a full-screen overlay (same pattern as WorkoutSharePreview) rather than a new route
// — it needs to scroll freely, which a route wouldn't add anything over.
export default function FullWorkoutRecap({ session, state, exMap, onClose }) {
  const data = useMemo(() => buildFullRecapData({ session, state, exMap }), [session, state, exMap]);
  const text = useMemo(() => buildFullRecapText(data), [data]);
  const [copied, setCopied] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  if (!data) return null;

  // "Share Image" (task section 15) — a tall document PNG of the exact same complete data, for
  // the athlete who wants an image rather than pasteable text (e.g. sending to a training
  // partner over a messaging app that previews images better than a wall of text).
  const shareImage = async () => {
    setImageBusy(true);
    try {
      const dataUrl = renderFullRecapImage({ session, exMap, state });
      if (!dataUrl) return;
      const filename = `brk-lift-full-recap.png`;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "BRK Full Recap", text: data.planName });
        return;
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      // native share cancelled, or image generation failed — nothing destructive to undo
    } finally {
      setImageBusy(false);
    }
  };

  const copyWorkout = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      // Clipboard API unavailable/denied — fall back to the native share sheet's own "Copy" if
      // present, otherwise there's nothing safe to do beyond leaving the text selectable on screen.
      if (navigator.share) {
        navigator.share({ text, title: "BRK Full Recap" }).catch(() => {});
      }
    }
  };

  const shareText = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text, title: `BRK — ${data.planName}` });
        return;
      } catch (e) {
        // cancelled — fall through to clipboard as a safe default
      }
    }
    copyWorkout();
  };

  return (
    <div className="fixed inset-0 z-50 bg-v5-bg flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0 bg-v5-bg">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red font-bold">BRK Lift</div>
          <div className="text-sm font-bold text-white">Full Workout Recap</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={shareImage} disabled={imageBusy} className="flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold text-v5-subtext hover:text-v5-red disabled:opacity-50">
            <ImageIcon size={14} /> {imageBusy ? "…" : "Image"}
          </button>
          <button onClick={onClose} className="p-1 text-v5-subtext hover:text-v5-red">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-5">
        {/* ---- header ---- */}
        <div>
          <div className="text-xl font-black text-white">{data.planName}</div>
          <div className="text-sm text-v5-subtext mt-0.5">
            {fmtDate(data.finishedAt || data.startedAt)}
            {data.startedAt && data.finishedAt && (
              <>
                {" · "}Started {fmtTime(data.startedAt)} · Finished {fmtTime(data.finishedAt)}
              </>
            )}
          </div>
        </div>

        {/* ---- session summary ---- */}
        <div className="border border-white/10 bg-v5-elevated p-4">
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold mb-3">Session Summary</div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Duration" value={data.durationLabel} />
            <Stat label="Working Sets" value={data.workingSets} />
            {data.warmupSets > 0 && <Stat label="Warm-up Sets" value={data.warmupSets} />}
            <Stat label="Total Reps" value={data.totalReps} />
            <Stat label="Volume" value={`${data.totalVolume.toLocaleString()} lb`} />
            <Stat label="PRs" value={data.prCount} accent={data.prCount > 0} />
          </div>
          {data.mainMuscles.length > 0 && (
            <div className="text-sm text-v5-text/90 mt-3 pt-3 border-t border-white/[0.06]">
              <span className="text-v5-subtext">Muscles trained: </span>
              {data.mainMuscles.join(", ")}
            </div>
          )}
        </div>

        {/* ---- session context ---- */}
        {(data.alternateGym || data.readiness) && (
          <div className="border border-white/10 bg-v5-elevated p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">Session Context</div>
            {data.readiness && (
              <div className="text-sm text-v5-text/90">
                Readiness: <span className="font-bold text-white">{data.readiness.score}/100</span>{" "}
                <span className="text-v5-subtext">({data.readiness.bandLabel})</span>
              </div>
            )}
            {data.alternateGym && (
              <div className="text-sm text-v5-red font-bold">Alternate gym{data.alternateGym.locationLabel ? ` — ${data.alternateGym.locationLabel}` : ""}</div>
            )}
          </div>
        )}

        {/* ---- PR summary ---- */}
        {data.prSummary.length > 0 && (
          <div className="border border-v5-red/30 bg-v5-red/10 p-4 space-y-2.5">
            <div className="text-[11px] uppercase tracking-widest text-v5-red font-bold flex items-center gap-1.5">
              <Award size={12} /> {data.prCount} PR{data.prCount === 1 ? "" : "s"}
            </div>
            {data.prSummary.map((p) => (
              <div key={p.exId} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <div className="text-white font-bold truncate">{p.name}</div>
                  <div className="text-xs text-v5-subtext">
                    {p.heroLabel} · {p.typeLabel}
                  </div>
                </div>
                <div className="text-green-500 font-bold text-xs shrink-0">{p.deltaLabel}</div>
              </div>
            ))}
          </div>
        )}

        {/* ---- complete exercise breakdown ---- */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold mb-2">Complete Exercise Breakdown</div>
          <div className="space-y-3">
            {data.exercises.map((ex, i) => (
              <ExerciseBlock key={`${ex.exId}_${i}`} ex={ex} index={i} />
            ))}
          </div>
        </div>

        {/* ---- workout notes ---- */}
        {data.note && (
          <div className="border border-white/10 bg-v5-elevated p-4 space-y-1.5">
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">Workout Notes</div>
            <div className="text-sm text-v5-text/90 leading-relaxed whitespace-pre-line">{data.note}</div>
          </div>
        )}

        {/* ---- vs last comparable session ---- */}
        {data.comparison && (
          <div className="border border-white/10 bg-v5-elevated p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">Vs Last {data.comparison.planName}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {data.comparison.deltaVolumePct != null && (
                <Delta label="Volume" value={`${data.comparison.deltaVolumePct >= 0 ? "+" : ""}${data.comparison.deltaVolumePct}%`} positive={data.comparison.deltaVolumePct >= 0} />
              )}
              {data.comparison.deltaWorkingSets != null && (
                <Delta label="Working sets" value={`${data.comparison.deltaWorkingSets >= 0 ? "+" : ""}${data.comparison.deltaWorkingSets}`} positive={data.comparison.deltaWorkingSets >= 0} />
              )}
              {data.comparison.deltaTotalReps != null && (
                <Delta label="Total reps" value={`${data.comparison.deltaTotalReps >= 0 ? "+" : ""}${data.comparison.deltaTotalReps}`} positive={data.comparison.deltaTotalReps >= 0} />
              )}
              <Delta label="PRs" value={String(data.comparison.prCount)} positive={data.comparison.prCount > 0} />
            </div>
            {data.comparison.bestLift && (
              <div className="text-xs text-v5-subtext pt-1">
                Best lift: <span className="text-white font-bold">{data.comparison.bestLift.current.weight} × {data.comparison.bestLift.current.reps}</span>{" "}
                vs {data.comparison.bestLift.previous.weight} × {data.comparison.bestLift.previous.reps}
              </div>
            )}
          </div>
        )}

        {/* ---- coach summary (interpretation, separate from raw data above) ---- */}
        {data.coachMessage && (
          <div className="border border-white/10 bg-v5-elevated p-4 space-y-1.5">
            <div className="text-[11px] uppercase tracking-widest text-v5-red font-bold">BRK Coach</div>
            <div className="text-sm text-v5-text/90 whitespace-pre-line">{data.coachMessage}</div>
          </div>
        )}
      </div>

      {/* ---- sticky actions ---- */}
      <div className="flex gap-2 p-4 border-t border-white/[0.06] shrink-0 bg-v5-bg" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <button
          onClick={copyWorkout}
          className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40 flex items-center justify-center gap-1.5"
        >
          {copied ? <Check size={14} className="text-v5-red" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy Workout"}
        </button>
        <button
          onClick={shareText}
          className="flex-1 py-3 text-xs uppercase tracking-widest font-bold bg-v5-red border border-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1.5"
        >
          <Share2 size={14} /> Share
        </button>
        <button onClick={onClose} className="px-5 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
          Done
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-v5-subtext/70">{label}</div>
      <div className={`text-lg font-bold ${accent ? "text-v5-red" : "text-white"}`}>{value}</div>
    </div>
  );
}

function Delta({ label, value, positive }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-v5-subtext">{label}</span>
      <span className={`font-bold ${positive ? "text-green-500" : "text-v5-subtext"}`}>{value}</span>
    </div>
  );
}
