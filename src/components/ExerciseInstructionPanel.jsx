import { PlayCircle, Info } from "lucide-react";
import { getExerciseInstruction } from "../content/exerciseInstructions.js";
import { Card, SectionLabel } from "./ui/Kit.jsx";

// Reusable exercise-demonstration surface (Beginner Experience V2, Stage 2B). Built so a future
// founder-filmed video library can be dropped in by populating exerciseInstructions.js alone —
// nothing here, and nothing in the workout logger that renders it, needs to change.
//
// Fallback chain, in order: video -> still image -> plain-language instructions/cue -> a safe
// "no demonstration yet" state. Never a broken image/video element, never fabricated media.
// `prefersReducedMotion` disables video autoplay (the video is also always muted and inline —
// see the <video> element below — so sound is never a concern either way).
export default function ExerciseInstructionPanel({ exId, exerciseName, compact = false }) {
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

  return (
    <Card tone="default" className={compact ? "py-2.5 space-y-2" : "space-y-2.5"}>
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
      ) : null}

      {content.instructions && (
        <div>
          <SectionLabel tone="muted" className="mb-1">
            How to do it
          </SectionLabel>
          <p className="text-xs text-v5-text/90 leading-relaxed">{content.instructions}</p>
        </div>
      )}
      {content.cue && (
        <div className="flex items-start gap-1.5 text-[11px] text-v5-red">
          <PlayCircle size={13} className="shrink-0 mt-[1px]" />
          <span>{content.cue}</span>
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
