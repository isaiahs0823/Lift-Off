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

// Lightweight by design (task section 7): only the profile name is required — gym/location,
// machine/brand, and notes are all optional, so creating a profile never demands more than the
// one thing that actually matters (a name to tell it apart from other machines). Shared by the
// main Equipment Profile sheet's "+ Add machine profile" and GuidedRunView's post-exercise "Save
// this machine profile" prompt so there's exactly one add form in the app, not two.
export function AddEquipmentProfileForm({ onSave, onCancel, saveLabel = "Save" }) {
  const [label, setLabel] = useState("");
  const [gymLabel, setGymLabel] = useState("");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="border border-white/10 bg-v5-elevated p-3 space-y-2.5">
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1">Profile name</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Eastside Gym Seated Curl"
          className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1">Gym / location (optional)</label>
        <input
          value={gymLabel}
          onChange={(e) => setGymLabel(e.target.value)}
          placeholder="Eastside Fitness"
          className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1">Machine / brand (optional)</label>
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Life Fitness"
          className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1">Notes (optional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Pin 8 is the sweet spot"
          className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => label.trim() && onSave(label.trim(), gymLabel.trim(), brand.trim(), notes.trim())}
          disabled={!label.trim()}
          className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border ${
            label.trim() ? "bg-v5-red border-v5-red text-white hover:opacity-90" : "border-white/10 text-v5-subtext/40 cursor-not-allowed"
          }`}
        >
          {saveLabel}
        </button>
        <button onClick={onCancel} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
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

  const saveNewProfile = (label, gymLabel, brand, notes) => {
    const id = `equipment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    updateState((prev) => ({ ...prev, equipmentProfiles: addEquipmentProfile(prev, exId, label, gymLabel, id, brand, notes) }));
    setAdding(false);
    onSelect({ equipmentProfileId: id, equipmentContext: null });
  };

  const markDefault = (profileId) => {
    updateState((prev) => ({ ...prev, equipmentProfiles: setDefaultEquipmentProfile(prev, exId, profileId) }));
  };

  return (
    <SlideInPanel title="Equipment Profile" subtitle={exName} onBack={onBack}>
      <p className="text-xs text-v5-subtext">Track this machine separately so progress compares apples to apples.</p>

      <div className="space-y-1.5">
        {/* Saved profiles for THIS exercise first (task section 2: "if profiles already exist
            for that movement, show them first") — Default Machine still always listed, just
            after them rather than before, so an exercise with real history on a named machine
            leads with that instead of the generic option nobody's actually using. */}
        {profiles.map((p) => {
          const selected = equipmentProfileId === p.id && equipmentContext !== TEMPORARY_EQUIPMENT_CONTEXT;
          return (
            <div key={p.id} className={`flex items-center border ${selected ? "border-v5-red bg-v5-red/10" : "border-white/10 bg-v5-elevated"}`}>
              <button
                onClick={() => onSelect({ equipmentProfileId: p.id, equipmentContext: null })}
                className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-3 text-left"
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selected ? "border-red-600" : "border-white/10"
                  }`}
                >
                  {selected && <span className="w-2 h-2 rounded-full bg-red-600" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-v5-text truncate">{p.label}</span>
                  {(p.gymLabel || p.brand || p.isDefault) && (
                    <span className="block text-[11px] text-v5-subtext truncate">
                      {[p.gymLabel, p.brand, p.isDefault ? "Usual for this exercise" : null].filter(Boolean).join(" · ")}
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
                  className="shrink-0 p-3 text-v5-subtext/70 hover:text-v5-red"
                >
                  <Star size={14} />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => onSelect({ equipmentProfileId: null, equipmentContext: null })}
          className={`w-full flex items-center gap-2.5 px-3 py-3 text-left border ${
            isDefaultSelected ? "border-v5-red bg-v5-red/10" : "border-white/10 bg-v5-elevated"
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              isDefaultSelected ? "border-red-600" : "border-white/10"
            }`}
          >
            {isDefaultSelected && <span className="w-2 h-2 rounded-full bg-red-600" />}
          </span>
          <span className="text-sm text-v5-text flex-1 truncate">Default Machine</span>
        </button>
      </div>

      {adding ? (
        <AddEquipmentProfileForm onSave={saveNewProfile} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={atCap}
          className={`w-full flex items-center justify-center gap-1.5 py-3 text-xs uppercase tracking-widest font-bold border border-dashed ${
            atCap ? "border-white/10 text-v5-subtext/40 cursor-not-allowed" : "border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red"
          }`}
        >
          <Plus size={14} /> {atCap ? `Limit reached (${MAX_PROFILES_PER_EXERCISE})` : "Add machine profile"}
        </button>
      )}

      <div className="pt-2 border-t border-white/[0.06]">
        <button
          onClick={() => onSelect({ equipmentProfileId: null, equipmentContext: TEMPORARY_EQUIPMENT_CONTEXT })}
          className={`w-full flex items-center justify-between px-3 py-3 text-left border ${
            isTemporarySelected ? "border-v5-red bg-v5-red/10" : "border-white/10 bg-v5-elevated"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-v5-text">Different machine today</span>
            <span className="block text-[11px] text-v5-subtext mt-0.5">One-off — won't affect saved profiles or suggestions</span>
          </span>
          {isTemporarySelected && <Check size={16} className="text-v5-red shrink-0" />}
        </button>
      </div>
    </SlideInPanel>
  );
}
