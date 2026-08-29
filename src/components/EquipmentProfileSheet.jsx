import { useState } from "react";
import { Check, Plus, Star } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import {
  profilesForExercise,
  addEquipmentProfile,
  setDefaultEquipmentProfile,
  MAX_PROFILES_PER_EXERCISE,
  TEMPORARY_EQUIPMENT_CONTEXT,
} from "../utils/equipmentProfiles.js";

// Extremely lightweight by design (task section 5): a name, an optional gym/location label,
// nothing else — no manufacturer, model, serial, resistance data, or photos. Shared by the main
// Equipment Profile sheet's "+ Add machine profile" and GuidedRunView's post-exercise "Save
// this machine profile" prompt so there's exactly one add form in the app, not two.
export function AddEquipmentProfileForm({ onSave, onCancel, saveLabel = "Save" }) {
  const [label, setLabel] = useState("");
  const [gymLabel, setGymLabel] = useState("");
  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-3 space-y-2.5">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Profile name</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Eastside Gym Seated Curl"
          className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Gym / location (optional)</label>
        <input
          value={gymLabel}
          onChange={(e) => setGymLabel(e.target.value)}
          placeholder="Eastside Fitness"
          className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => label.trim() && onSave(label.trim(), gymLabel.trim())}
          disabled={!label.trim()}
          className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border ${
            label.trim() ? "bg-red-700 border-red-700 text-white hover:bg-red-600" : "border-neutral-800 text-neutral-700 cursor-not-allowed"
          }`}
        >
          {saveLabel}
        </button>
        <button onClick={onCancel} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

// The compact BRK-native sheet from task section 4: a radio list ("Default Machine" first, then
// every saved profile for this exercise), an inline "+ Add machine profile" form, and a
// "Different machine today" quick action for a one-off, unsaved temporary session (section 16).
// One sheet, no stacked screens — the add form expands in place rather than pushing a new panel,
// keeping modal depth flat per the task's 375px QA requirement.
export default function EquipmentProfileSheet({ exId, exName, state, updateState, equipmentProfileId, equipmentContext, onSelect, onBack }) {
  const [adding, setAdding] = useState(false);
  const profiles = profilesForExercise(state, exId);
  const atCap = profiles.length >= MAX_PROFILES_PER_EXERCISE;

  const isDefaultSelected = !equipmentProfileId && equipmentContext !== TEMPORARY_EQUIPMENT_CONTEXT;
  const isTemporarySelected = equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT;

  const saveNewProfile = (label, gymLabel) => {
    const id = `equipment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    updateState((prev) => ({ ...prev, equipmentProfiles: addEquipmentProfile(prev, exId, label, gymLabel, id) }));
    setAdding(false);
    onSelect({ equipmentProfileId: id, equipmentContext: null });
  };

  const markDefault = (profileId) => {
    updateState((prev) => ({ ...prev, equipmentProfiles: setDefaultEquipmentProfile(prev, exId, profileId) }));
  };

  return (
    <SlideInPanel title="Equipment Profile" subtitle={exName} onBack={onBack}>
      <p className="text-xs text-neutral-500">Track this machine separately so progress compares apples to apples.</p>

      <div className="space-y-1.5">
        <button
          onClick={() => onSelect({ equipmentProfileId: null, equipmentContext: null })}
          className={`w-full flex items-center gap-2.5 px-3 py-3 text-left border ${
            isDefaultSelected ? "border-red-700 bg-red-950/10" : "border-neutral-800 bg-charcoal-panel"
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              isDefaultSelected ? "border-red-600" : "border-neutral-700"
            }`}
          >
            {isDefaultSelected && <span className="w-2 h-2 rounded-full bg-red-600" />}
          </span>
          <span className="text-sm text-neutral-100 flex-1 truncate">Default Machine</span>
        </button>

        {profiles.map((p) => {
          const selected = equipmentProfileId === p.id && equipmentContext !== TEMPORARY_EQUIPMENT_CONTEXT;
          return (
            <div key={p.id} className={`flex items-center border ${selected ? "border-red-700 bg-red-950/10" : "border-neutral-800 bg-charcoal-panel"}`}>
              <button
                onClick={() => onSelect({ equipmentProfileId: p.id, equipmentContext: null })}
                className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-3 text-left"
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selected ? "border-red-600" : "border-neutral-700"
                  }`}
                >
                  {selected && <span className="w-2 h-2 rounded-full bg-red-600" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-neutral-100 truncate">{p.label}</span>
                  {(p.gymLabel || p.isDefault) && (
                    <span className="block text-[10px] text-neutral-500 truncate">
                      {[p.gymLabel, p.isDefault ? "Usual for this exercise" : null].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </button>
              {!p.isDefault && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markDefault(p.id);
                  }}
                  aria-label={`Set ${p.label} as usual profile`}
                  title="Set as usual profile"
                  className="shrink-0 p-3 text-neutral-600 hover:text-red-500"
                >
                  <Star size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <AddEquipmentProfileForm onSave={saveNewProfile} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={atCap}
          className={`w-full flex items-center justify-center gap-1.5 py-3 text-xs uppercase tracking-widest font-bold border border-dashed ${
            atCap ? "border-neutral-800 text-neutral-700 cursor-not-allowed" : "border-neutral-700 text-neutral-300 hover:border-red-700 hover:text-red-500"
          }`}
        >
          <Plus size={14} /> {atCap ? `Limit reached (${MAX_PROFILES_PER_EXERCISE})` : "Add machine profile"}
        </button>
      )}

      <div className="pt-2 border-t border-neutral-900">
        <button
          onClick={() => onSelect({ equipmentProfileId: null, equipmentContext: TEMPORARY_EQUIPMENT_CONTEXT })}
          className={`w-full flex items-center justify-between px-3 py-3 text-left border ${
            isTemporarySelected ? "border-red-700 bg-red-950/10" : "border-neutral-800 bg-charcoal-panel"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-neutral-100">Different machine today</span>
            <span className="block text-[10px] text-neutral-500 mt-0.5">One-off — won't affect saved profiles or suggestions</span>
          </span>
          {isTemporarySelected && <Check size={16} className="text-red-500 shrink-0" />}
        </button>
      </div>
    </SlideInPanel>
  );
}
