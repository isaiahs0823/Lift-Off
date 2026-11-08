import { useState } from "react";
import { Info, Lightbulb } from "lucide-react";
import { getExerciseInstruction, instructionSteps } from "../content/exerciseInstructions.js";
import { Card, SegmentedTabs } from "./ui/Kit.jsx";

// Reusable exercise-demonstration surface — How To / Tips / Muscles switcher matching the V2
// reference board. Built so a future founder-filmed video library can be dropped in by
// populating exerciseInstructions.js alone — nothing here, and nothing in the workout logger
// that renders it, needs to change.
//
// Fallback chain, in order: video -> still image -> plain-language instructions/cue -> a safe
// "no demonstration yet" state. Never a broken image/video element, never a fake play button over
// nothing — every exId in the catalog today has null video/image, so that fallback is the common
// case, not an edge case. `prefersReducedMotion` disables video autoplay (also always muted and
// inline, so sound is never a concern either way).
export default function ExerciseInstructionPanel({ exId, exerciseName, muscle, compact = false }) {
  const [tab, setTab] = useState("howto");
  const content = getExerciseInstruction(exId);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!content) {
    return (
      <Card tone="default" className={compact ? "py-2.5" : ""}>
        <div className="flex items-center gap-2 text-v5-subtext text-xs">
          <Info size={14} className="shrink-0" />
          <span>No demonstration for {exerciseName || "this exercise"} yet — form cues are coming soon.</span>
        </div>
      </Card>
    );
  }

  const steps = instructionSteps(content.instructions);

  return (
    <Card tone="default" className={compact ? "py-2.5 space-y-3" : "space-y-3"}>
      {content.video ? (
        <video
          className="w-full rounded-lg bg-black"
          src={content.video.src}
          poster={content.video.poster || undefined}
          muted
          playsInline
          loop
          autoPlay={!prefersReducedMotion}
          controls={prefersReducedMotion}
          preload="none"
        />
      ) : content.image ? (
        <img src={content.image} alt={`${exerciseName || exId} demonstration`} loading="lazy" className="w-full rounded-lg object-cover" />
      ) : (
        // Honest placeholder — no video/image exists for any exercise yet, so this is the
        // everyday state, not a broken fallback. Deliberately NOT a fake video player chrome
        // (no play button over nothing): that would misrepresent what's actually here.
        <div className="w-full rounded-lg bg-v5-elevated flex items-center justify-center py-6">
          <div className="flex items-center gap-2 text-v5-subtext text-xs">
            <Info size={14} className="shrink-0" />
            <span>No demonstration video yet</span>
          </div>
        </div>
      )}

      <SegmentedTabs
        tabs={[
          { value: "howto", label: "How To" },
          { value: "tips", label: "Tips" },
          { value: "muscles", label: "Muscles" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "howto" && steps.length > 0 && (
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-v5-red text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-xs text-v5-text/90 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {tab === "tips" &&
        (content.cue ? (
          <div className="flex items-start gap-1.5 text-xs text-v5-text/90">
            <Lightbulb size={13} className="shrink-0 mt-0.5 text-v5-red" />
            <span>{content.cue}</span>
          </div>
        ) : (
          <div className="text-xs text-v5-subtext">No additional tips yet for this exercise.</div>
        ))}

      {tab === "muscles" && (
        <div className="text-xs text-v5-text/90">
          {muscle ? (
            <div>
              <span className="text-v5-subtext uppercase tracking-wide text-[11px]">Primary — </span>
              {muscle}
            </div>
          ) : (
            <div className="text-v5-subtext">Muscle data not available for this exercise.</div>
          )}
        </div>
      )}

      {/* Required disclosure, owned here so no caller can accidentally drop it: form cues are
          written for this prototype, not reviewed by a trainer/physical therapist, and no video
          here (today, none exist) should ever be read as professionally verified. */}
      <p className="text-[10px] text-v5-subtext/50">
        General form guidance, not professionally verified. Stop and consult a trainer if something doesn't feel right.
      </p>
    </Card>
  );
}
