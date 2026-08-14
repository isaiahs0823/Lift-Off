import React, { useState } from "react";
import { ChevronRight, X, Pencil, Trash2 } from "lucide-react";
import { resolveProfile, COACHING_STYLE_LABEL, RESPONSE_LENGTH_LABEL } from "../utils/athleteProfile.js";
import { editMemory, deleteMemory, correctMemory, MEMORY_CATEGORY_LABEL, confidenceLabel } from "../utils/coachMemoryStore.js";

const STATUS_LABEL = { active: "Active", improving: "Improving", resolved: "Resolved", outdated: "Corrected" };
const STATUS_COLOR = { active: "text-red-500", improving: "text-yellow-500", resolved: "text-green-500", outdated: "text-neutral-600" };

function Section({ title, children, empty }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-widest text-red-600">{title}</div>
      {children || <div className="text-sm text-neutral-600">{empty}</div>}
    </div>
  );
}

// A single Layer-3 memory row: edit its text, delete it outright, or — for anything that isn't
// directly user-stated — "That's not right" (section 15), which downgrades confidence and
// marks it outdated rather than pretending the Coach was correct.
function MemoryRow({ memory, updateState }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.text);
  const [correcting, setCorrecting] = useState(false);

  const save = () => {
    updateState((prev) => ({ ...prev, coachMemories: editMemory(prev.coachMemories || [], memory.id, draft.trim()) }));
    setEditing(false);
  };
  const remove = () => {
    if (!window.confirm("Remove this memory? Coach will stop using it.")) return;
    updateState((prev) => ({ ...prev, coachMemories: deleteMemory(prev.coachMemories || [], memory.id) }));
  };
  const correct = (removeEntirely) => {
    updateState((prev) => ({ ...prev, coachMemories: correctMemory(prev.coachMemories || [], memory.id, { remove: removeEntirely }) }));
    setCorrecting(false);
  };

  if (editing) {
    return (
      <div className="border border-neutral-800 bg-charcoal-panel p-3 space-y-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
        <div className="flex gap-2">
          <button onClick={save} className="flex-1 py-1.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="flex-1 py-1.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-neutral-200">{memory.text}</div>
        <div className="shrink-0 flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="text-neutral-600 hover:text-red-500 p-0.5">
            <Pencil size={13} />
          </button>
          <button onClick={remove} className="text-neutral-600 hover:text-red-500 p-0.5">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
        <span className={STATUS_COLOR[memory.status]}>{STATUS_LABEL[memory.status]}</span>
        {memory.source !== "stated" && <span className="text-neutral-600">{confidenceLabel(memory.evidenceCount)} confidence</span>}
        {memory.source !== "stated" && !correcting && (
          <button onClick={() => setCorrecting(true)} className="text-neutral-600 hover:text-red-500 ml-auto normal-case tracking-normal">
            That's not right
          </button>
        )}
      </div>
      {correcting && (
        <div className="flex items-center gap-2 pt-1 border-t border-neutral-900">
          <span className="text-xs text-neutral-500">Correct Coach:</span>
          <button onClick={() => correct(false)} className="text-xs text-yellow-500 hover:text-yellow-400">
            Lower confidence
          </button>
          <button onClick={() => correct(true)} className="text-xs text-red-500 hover:text-red-400">
            Remove
          </button>
          <button onClick={() => setCorrecting(false)} className="text-xs text-neutral-600 hover:text-neutral-400 ml-auto">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function CoachKnowledgeScreen({ state, updateState, onNavigate, onBack }) {
  const profile = resolveProfile(state);
  const memories = state.coachMemories || [];
  const goals = state.goals || [];
  const primary = goals.find((g) => g.status === "active" && g.priority === "primary");
  const secondary = goals.filter((g) => g.status === "active" && g.priority !== "primary");

  const patterns = memories.filter((m) => (m.category === "behavioralPatterns" || m.category === "trainingInsights") && m.status !== "outdated");
  const statedPreferences = memories.filter((m) => m.category === "preferences");
  const statedConstraints = memories.filter((m) => m.category === "constraints");

  const removeConstraintTag = (tag) => {
    updateState((prev) => ({ ...prev, athleteProfile: { ...resolveProfile(prev), constraints: (prev.athleteProfile?.constraints || []).filter((c) => c !== tag) } }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
          <div className="text-xl font-bold text-white mt-1">What Coach knows about you</div>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
            ← Back
          </button>
        )}
      </div>

      <Section title="Goals" empty="No active goal set yet.">
        {(primary || secondary.length > 0) && (
          <button onClick={() => onNavigate?.("mission")} className="w-full text-left border border-neutral-800 bg-charcoal-panel p-3 hover:border-neutral-600 space-y-1">
            {primary && <div className="text-sm text-white font-bold">{primary.title}</div>}
            {secondary.map((g) => (
              <div key={g.id} className="text-xs text-neutral-500">{g.title}</div>
            ))}
            <div className="text-[10px] uppercase tracking-widest text-neutral-600 flex items-center gap-1 pt-1">
              Edit on Mission <ChevronRight size={10} />
            </div>
          </button>
        )}
      </Section>

      <Section title="Training preferences" empty="Nothing set yet — add this from Coach Settings.">
        {(profile.preferredDays || profile.preferredDuration || profile.trainingStyle || profile.equipment.length > 0) && (
          <div className="border border-neutral-800 bg-charcoal-panel p-3 space-y-1 text-sm text-neutral-300">
            {profile.preferredDays && <div>Prefers {profile.preferredDays} lifting days/week.</div>}
            {profile.preferredDuration && <div>Prefers ~{profile.preferredDuration} minute sessions.</div>}
            {profile.trainingStyle && <div>{profile.trainingStyle}</div>}
            {profile.equipment.length > 0 && <div>Equipment: {profile.equipment.join(", ")}</div>}
          </div>
        )}
        {statedPreferences.map((m) => (
          <MemoryRow key={m.id} memory={m} updateState={updateState} />
        ))}
      </Section>

      <Section title="Constraints" empty="No constraints noted.">
        {profile.constraints.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.constraints.map((c) => (
              <span key={c} className="flex items-center gap-1 px-2.5 py-1 text-xs border border-neutral-800 text-neutral-300 bg-charcoal-panel">
                {c}
                <button onClick={() => removeConstraintTag(c)} className="text-neutral-600 hover:text-red-500">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        {statedConstraints.map((m) => (
          <MemoryRow key={m.id} memory={m} updateState={updateState} />
        ))}
      </Section>

      <Section title="Coaching style">
        <div className="border border-neutral-800 bg-charcoal-panel p-3 text-sm text-neutral-300 space-y-1">
          <div>{COACHING_STYLE_LABEL[profile.coachingStyle]}.</div>
          <div>{RESPONSE_LENGTH_LABEL[profile.responseLength]} responses.</div>
        </div>
      </Section>

      <Section title="Patterns Coach has noticed" empty="Nothing yet — patterns show up once there's enough training data to support one.">
        {patterns.length > 0 && (
          <div className="space-y-2">
            {patterns.map((m) => (
              <MemoryRow key={m.id} memory={m} updateState={updateState} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Motivation" empty="Not set — add this from Coach Settings.">
        {profile.motivation && (
          <div className="border border-neutral-800 bg-charcoal-panel p-3 text-sm text-neutral-300">
            {profile.motivation}
            <div className="text-[10px] uppercase tracking-widest text-neutral-600 mt-2">Private — never shared automatically</div>
          </div>
        )}
      </Section>
    </div>
  );
}
