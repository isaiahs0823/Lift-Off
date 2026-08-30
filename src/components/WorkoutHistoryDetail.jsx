import React, { useState } from "react";
import { ChevronDown, ChevronUp, Award, MessageCircle } from "lucide-react";
import { formatSetVerbose, formatSessionDuration, SET_TYPE_LABEL } from "../utils/workoutSets.js";
import { featuredAndOtherPRs, sessionPRCount, PR_TYPE_LABEL, prDeltaLabel, prHeroLabel } from "../utils/prSummary.js";
import { buildWorkoutShareCard } from "../utils/shareCard.js";
import ShareCardButton from "./ShareCardButton.jsx";
import { equipmentDisplayLabel } from "../utils/equipmentProfiles.js";
import { SET_QUALITY_GLYPH, SET_QUALITY_LABEL } from "../utils/workoutQuality.js";
import { FileText } from "lucide-react";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// The permanent, read-only receipt for a finished session (spec: "not what the program was
// supposed to be — what actually happened"). Every entry point (Today, Program day list,
// Training Calendar, Session Complete) opens this exact component with a session object looked
// up by its stable id — there is deliberately only one implementation of this screen.
export default function WorkoutHistoryDetail({ session, state, exMap, onBack, onAskCoach, onViewRecap }) {
  const [collapsed, setCollapsed] = useState({});

  if (!session) {
    return (
      <div className="space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Workout Details</div>
        <div className="text-sm text-neutral-400">This workout couldn't be found.</div>
        <button onClick={onBack} className="text-xs uppercase tracking-widest text-red-500 hover:text-red-400">
          ← Back
        </button>
      </div>
    );
  }

  const prsByExId = new Map();
  (session.prs || []).forEach((pr) => {
    if (!prsByExId.has(pr.exId)) prsByExId.set(pr.exId, []);
    prsByExId.get(pr.exId).push(pr);
  });
  const { featured, others } = featuredAndOtherPRs(session);
  const prList = [featured, ...others].filter(Boolean);
  const prCount = sessionPRCount(session);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Workout Details</div>
          <div className="text-xl font-bold text-white mt-1">{session.planName}</div>
        </div>
        <button onClick={onBack} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
          ← Back
        </button>
      </div>

      <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
        <div className="text-sm text-neutral-400">
          {fmtDate(session.finishedAt)}
          <br />
          Started {fmtTime(session.startedAt)} · Finished {fmtTime(session.finishedAt)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Duration</div>
            <div className="text-lg font-bold text-white">{formatSessionDuration(session.durationSec)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Working sets</div>
            <div className="text-lg font-bold text-white">{session.workingSets}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Volume</div>
            <div className="text-lg font-bold text-white">
              {session.totalVolume.toLocaleString()} lb{session.isVolumePR ? " — PR" : ""}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Total reps</div>
            <div className="text-lg font-bold text-white">{session.totalReps}</div>
          </div>
        </div>
        <div className="text-sm text-neutral-300">Exercises completed: {session.exerciseCount}</div>
        {session.mainMuscles?.length > 0 && <div className="text-sm text-neutral-300">Muscles trained: {session.mainMuscles.join(", ")}</div>}
        {session.sessionContext?.locationMode === "alternate_gym" && (
          <div className="text-[10px] uppercase tracking-widest text-red-600 font-bold border-t border-neutral-900 pt-2">
            Alternate gym{session.sessionContext.locationLabel ? ` — ${session.sessionContext.locationLabel}` : ""}
          </div>
        )}
      </div>

      {onViewRecap && (
        <button
          onClick={() => onViewRecap(session.id)}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-xs uppercase tracking-widest font-bold border border-red-700 text-red-500 hover:bg-red-950/30"
        >
          <FileText size={13} /> View Recap
        </button>
      )}

      {prCount > 0 && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-2.5">
          <div className="text-[11px] uppercase tracking-widest text-red-600 font-bold flex items-center gap-1.5">
            <Award size={12} /> PRs
          </div>
          {prList.map(({ exId, pr }) => (
            <div key={exId} className="flex items-center justify-between text-sm gap-2">
              <div className="min-w-0">
                <div className="text-white font-bold truncate">{exMap[exId]?.name || exId}</div>
                <div className="text-neutral-500 text-xs">
                  {prHeroLabel(pr)} · {PR_TYPE_LABEL[pr.type]}
                </div>
              </div>
              <div className="text-green-500 font-bold shrink-0">{prDeltaLabel(pr)}</div>
            </div>
          ))}
        </div>
      )}

      {session.entries?.length > 0 ? (
        <div className="space-y-3">
          {session.entries.map((entry, i) => {
            const exPRs = prsByExId.get(entry.exId) || [];
            const key = `${entry.exId}_${i}`;
            const isCollapsed = !!collapsed[key];
            const note = state.exerciseNotes?.[entry.exId]?.general?.trim();
            return (
              <div key={key} className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
                <button onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))} className="w-full flex items-center justify-between text-left gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-bold text-white truncate">{exMap[entry.exId]?.name || entry.exId}</span>
                    {exPRs.length > 0 && <span className="shrink-0 text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5">PR</span>}
                    {(entry.equipmentProfileId || entry.equipmentContext) && (
                      <span className="shrink-0 text-[10px] text-neutral-500 truncate">{equipmentDisplayLabel(state, entry.equipmentProfileId, entry.equipmentContext)}</span>
                    )}
                  </div>
                  {isCollapsed ? <ChevronDown size={16} className="text-neutral-600 shrink-0" /> : <ChevronUp size={16} className="text-neutral-600 shrink-0" />}
                </button>
                {!isCollapsed && (
                  <>
                    <div className="space-y-1.5">
                      {entry.sets.map((s, si) => (
                        <div key={si} className="flex items-center gap-2 text-sm">
                          <span className="text-neutral-500 shrink-0 w-14">Set {si + 1}</span>
                          <span className="text-white flex-1">{formatSetVerbose(s)}</span>
                          {s.quality && s.quality !== "clean" && (
                            <span
                              className="text-[10px] uppercase tracking-widest text-red-500 shrink-0"
                              title={s.quality === "pain" && s.pain?.bodyArea ? `${s.pain.bodyArea} — ${s.pain.severity ?? "?"}/10` : undefined}
                            >
                              {SET_QUALITY_GLYPH[s.quality]} {SET_QUALITY_LABEL[s.quality]}
                            </span>
                          )}
                          <span className="text-[10px] uppercase tracking-widest text-neutral-600 shrink-0">{SET_TYPE_LABEL[s.setType || "working"]}</span>
                        </div>
                      ))}
                    </div>
                    {entry.jointNote && (
                      <div className="text-xs text-red-500 border-t border-neutral-900 pt-2">
                        {entry.jointNote.bodyArea ? `${entry.jointNote.bodyArea} discomfort` : "Discomfort noted"}
                        {entry.jointNote.severity != null ? `: ${entry.jointNote.severity}/10` : ""}
                        {entry.jointNote.note ? ` — ${entry.jointNote.note}` : ""}
                      </div>
                    )}
                    {exPRs.length > 0 && (
                      <div className="text-xs text-red-500 font-bold border-t border-neutral-900 pt-2">
                        {exPRs.map((pr) => `${PR_TYPE_LABEL[pr.type]} — ${prDeltaLabel(pr)}${pr.qualityFlag ? ` (${SET_QUALITY_LABEL[pr.qualityFlag]} flagged)` : ""}`).join(" · ")}
                      </div>
                    )}
                    {note && (
                      <div className="border-t border-neutral-900 pt-2">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Note</div>
                        <div className="text-sm text-neutral-300 whitespace-pre-line">{note}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-neutral-500 border border-neutral-800 bg-charcoal-panel p-4">
          Detailed set-by-set data isn't available for this session — it was completed before this feature was added. The totals above are still accurate.
        </div>
      )}

      {session.coachMessage && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-red-600 mb-1.5 flex items-center gap-1.5">
            <MessageCircle size={11} /> Coach review
          </div>
          <div className="text-sm text-neutral-300 whitespace-pre-line">{session.coachMessage}</div>
        </div>
      )}

      <div className="border-t border-neutral-900 pt-3">
        <ShareCardButton buildDataUrl={() => buildWorkoutShareCard(session)} filename="brk-lift-session.png" label="Share Workout" />
      </div>

      {onAskCoach && (
        <button
          onClick={() => onAskCoach(session)}
          className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-red-700 text-red-500 hover:bg-red-950/30"
        >
          Ask Coach About This Workout
        </button>
      )}

      <button onClick={onBack} className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
        Done
      </button>
    </div>
  );
}
