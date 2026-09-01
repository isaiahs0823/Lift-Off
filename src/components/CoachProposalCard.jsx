import React, { useState } from "react";
import { createCommitment } from "../utils/commitments.js";
import { applyAdjustment } from "../services/nutritionCoachService.js";
import { createProgramFromProposal } from "../utils/programProposal.js";
import { buildFixedScheduleFromProgramDays } from "../utils/weeklySchedule.js";

// Renders under a specific chat message when that turn's tool call proposed a commitment, a
// nutrition target change, or a full training program (see coachConversations.js's
// extractProposalFromToolResults). Never mutates anything until the athlete taps a button —
// matches every other confirm-before-change flow already in BRK (spec section 11/12/37): the
// model can only propose, never write.
export default function CoachProposalCard({ proposal, updateState, exMap, allExercises, onResolve }) {
  if (!proposal || proposal.status !== "pending") {
    if (proposal?.status && proposal.status !== "pending") {
      const label =
        proposal.status === "accepted" ? "Accepted" : proposal.status === "modified" ? "Accepted (modified)" : proposal.status === "superseded" ? "Superseded — see below" : "Declined";
      return <div className="text-[11px] uppercase tracking-widest text-v5-subtext/70 mt-2">{label}</div>;
    }
    return null;
  }
  if (proposal.proposalType === "commitment") return <CommitmentProposal proposal={proposal.proposal} updateState={updateState} onResolve={onResolve} />;
  if (proposal.proposalType === "nutrition_target_change") return <NutritionProposal proposal={proposal.proposal} updateState={updateState} onResolve={onResolve} />;
  if (proposal.proposalType === "program") {
    return <ProgramProposal proposal={proposal.proposal} updateState={updateState} exMap={exMap} allExercises={allExercises} onResolve={onResolve} />;
  }
  return null;
}

function CommitmentProposal({ proposal, updateState, onResolve }) {
  const accept = () => {
    const commitment = createCommitment(proposal);
    updateState((prev) => ({ ...prev, commitments: [...(prev.commitments || []), commitment] }));
    onResolve("accepted");
  };
  const decline = () => onResolve("declined");

  return (
    <div className="mt-2 rounded-xl bg-v5-elevated ring-1 ring-v5-red/20 p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-v5-red">Proposed commitment</div>
      <div className="text-sm text-white font-bold">{proposal.text}</div>
      <div className="flex gap-2 pt-1">
        <button onClick={accept} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-red text-white hover:opacity-90">
          Accept Commitment
        </button>
        <button onClick={decline} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-elevated text-v5-subtext hover:text-v5-text">
          Not Now
        </button>
      </div>
    </div>
  );
}

function NutritionProposal({ proposal, updateState, onResolve }) {
  const [modifying, setModifying] = useState(false);
  const [modifiedCalories, setModifiedCalories] = useState(String(proposal.toCalories));

  const apply = (action, calories) => {
    updateState((prev) => {
      const patch = applyAdjustment(prev, proposal, action, calories);
      return { ...prev, ...patch };
    });
    onResolve(action === "modify" ? "modified" : action === "decline" ? "declined" : "accepted");
  };

  return (
    <div className="mt-2 rounded-xl bg-v5-elevated ring-1 ring-v5-red/20 p-3 space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-v5-red">Proposed nutrition target change</div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext/70 mb-1">Current</div>
          <div className="text-white font-bold">{proposal.fromCalories} kcal</div>
          <div className="text-v5-subtext text-xs">
            {proposal.fromMacros.protein}P · {proposal.fromMacros.carbs}C · {proposal.fromMacros.fat}F
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext/70 mb-1">Proposed</div>
          <div className="text-white font-bold">{proposal.toCalories} kcal</div>
          <div className="text-v5-subtext text-xs">
            {proposal.toMacros.protein}P · {proposal.toMacros.carbs}C · {proposal.toMacros.fat}F
          </div>
        </div>
      </div>
      <div className="text-xs text-v5-subtext">
        <span className="text-v5-subtext/70 uppercase tracking-widest text-[10px]">Why — </span>
        {proposal.reason}
      </div>

      {modifying ? (
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-widest text-v5-subtext/70">Calories</label>
          <input
            type="number"
            inputMode="decimal"
            value={modifiedCalories}
            onChange={(e) => setModifiedCalories(e.target.value)}
            className="w-full bg-v5-muted rounded-lg text-v5-text px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-v5-red"
          />
          <div className="flex gap-2">
            <button onClick={() => apply("modify", Number(modifiedCalories) || proposal.toCalories)} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-red text-white hover:opacity-90">
              Save
            </button>
            <button onClick={() => setModifying(false)} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-elevated text-v5-subtext hover:text-v5-text">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => apply("accepted")} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-red text-white hover:opacity-90">
            Accept
          </button>
          <button onClick={() => setModifying(true)} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-elevated text-v5-text/90 hover:text-v5-text">
            Modify
          </button>
          <button onClick={() => apply("declined")} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-elevated text-v5-subtext hover:text-v5-text">
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

function nextMonday() {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun..6=Sat
  const daysUntil = dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow;
  d.setDate(d.getDate() + daysUntil);
  return d;
}

// Section 15/20 — full day-by-day review + weekly volume before anything is saved, with an
// explicit start-date choice. "Modify with Coach" (section 16) is deliberately not a separate
// button here: the athlete is already inside the same chat, so asking for a change is just
// typing the next message — Coach re-calls proposeProgram and a new card appears. A dedicated
// button would only duplicate that.
function ProgramProposal({ proposal, updateState, exMap, allExercises, onResolve }) {
  const [stage, setStage] = useState("review"); // "review" | "startDate"
  const [startOption, setStartOption] = useState("today");
  const [customDate, setCustomDate] = useState("");

  const decline = () => onResolve("declined");

  function resolveStartDate() {
    if (startOption === "nextMonday") return nextMonday();
    if (startOption === "custom" && customDate) return new Date(`${customDate}T00:00:00`);
    return new Date();
  }

  function save() {
    const startDate = resolveStartDate();
    const { program, newCustomExercises } = createProgramFromProposal(proposal, { exMap, allExercises });
    updateState((prev) => {
      const nextCurrentProgram = {
        programId: program.id,
        programName: program.name,
        source: "custom",
        dayIndex: 0,
        totalDays: program.days.length,
        startDate: startDate.toISOString(),
      };
      // Section 21 — a "fixed" schedule needs weeklySchedule configured too, not just the
      // program saved, or Today has no idea which weekday each generated day belongs to (see
      // buildFixedScheduleFromProgramDays in weeklySchedule.js for why).
      const nextWeeklySchedule =
        program.scheduleMode === "fixed"
          ? { mode: "fixed", fixedDays: buildFixedScheduleFromProgramDays(program.days, prev.weeklySchedule?.mode === "fixed" ? prev.weeklySchedule.fixedDays : null), createdAt: startDate.toISOString() }
          : prev.weeklySchedule;
      return {
        ...prev,
        customExercises: newCustomExercises.length ? [...(prev.customExercises || []), ...newCustomExercises] : prev.customExercises,
        customPrograms: [...(prev.customPrograms || []), program],
        currentProgram: nextCurrentProgram,
        weeklySchedule: nextWeeklySchedule,
      };
    });
    onResolve("accepted");
  }

  if (stage === "startDate") {
    return (
      <div className="mt-2 rounded-xl bg-v5-elevated ring-1 ring-v5-red/20 p-3 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-v5-red">When do you want to start?</div>
        <div className="space-y-2">
          {[
            ["today", "Start Today"],
            ["nextMonday", "Start Next Monday"],
            ["custom", "Select Date"],
          ].map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 text-sm text-v5-text/90">
              <input type="radio" name="programStartOption" checked={startOption === val} onChange={() => setStartOption(val)} />
              {label}
            </label>
          ))}
          {startOption === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full bg-v5-muted rounded-lg text-v5-text px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-v5-red"
            />
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={startOption === "custom" && !customDate}
            className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-red text-white hover:opacity-90 disabled:opacity-40"
          >
            Confirm &amp; Save
          </button>
          <button onClick={() => setStage("review")} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-elevated text-v5-subtext hover:text-v5-text">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-v5-elevated ring-1 ring-v5-red/20 p-3 space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-v5-red">Proposed program</div>
      <div className="text-sm text-white font-bold">{proposal.name}</div>
      {proposal.tagline && <div className="text-xs text-v5-subtext">{proposal.tagline}</div>}
      {proposal.scheduleWarning && <div className="text-xs text-amber-500 border border-amber-900/40 bg-amber-950/20 px-2 py-1.5">{proposal.scheduleWarning}</div>}

      <div className="space-y-2">
        {(proposal.days || []).map((day) => {
          const workingSets = (day.exercises || []).reduce((s, e) => s + (Number(e.sets) || 0), 0);
          return (
            <div key={day.id} className="rounded-lg bg-v5-muted/40 px-2.5 py-2">
              <div className="flex justify-between items-baseline gap-2">
                <div className="text-xs font-bold text-white">{day.label}</div>
                <div className="text-[10px] text-v5-subtext whitespace-nowrap">
                  {(day.exercises || []).length} exercises · {workingSets} working sets
                </div>
              </div>
              <div className="mt-1 space-y-0.5">
                {(day.exercises || []).map((ex, i) => (
                  <div key={i} className="text-[11px] text-v5-subtext">
                    {ex.exerciseName} — {ex.sets}x{ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`} @ {ex.targetRir} RIR
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {proposal.plannedVolume && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext/70 mb-1">Weekly volume</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-v5-subtext">
            {Object.entries(proposal.plannedVolume).map(([muscle, sets]) => (
              <div key={muscle}>
                {muscle}: {sets}
              </div>
            ))}
          </div>
        </div>
      )}

      {proposal.reasoning && (
        <div className="text-xs text-v5-subtext">
          <span className="text-v5-subtext/70 uppercase tracking-widest text-[10px]">Why — </span>
          {proposal.reasoning}
        </div>
      )}

      <div className="text-[11px] text-v5-subtext/70">Want changes? Just tell your Coach — e.g. "swap barbell squats for hack squats."</div>

      <div className="flex gap-2 pt-1">
        <button onClick={() => setStage("startDate")} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-red text-white hover:opacity-90">
          Save Program
        </button>
        <button onClick={decline} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold rounded-lg bg-v5-elevated text-v5-subtext hover:text-v5-text">
          Not Now
        </button>
      </div>
    </div>
  );
}
