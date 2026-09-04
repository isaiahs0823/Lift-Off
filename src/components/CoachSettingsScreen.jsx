import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  COACHING_STYLES,
  COACHING_STYLE_LABEL,
  COACHING_STYLE_DESC,
  RESPONSE_LENGTHS,
  RESPONSE_LENGTH_LABEL,
  PHYSIQUE_PHASES,
  PHYSIQUE_PHASE_LABEL,
  PHYSIQUE_PRIORITY_MUSCLES,
  resolveProfile,
} from "../utils/athleteProfile.js";
import { getSpecialty } from "../coachSpecialties/index.js";

// The Coach-specific control panel (section 39): tone/length/learning toggle plus entry points
// into the two deeper screens (full profile editor, What Coach Knows). Distinct from
// AthleteProfileForm's edit mode — that's the full ~10-field profile; this is just "how Coach
// behaves," saved immediately per change rather than behind a Save button, matching how a
// settings screen (not a form) is expected to behave.
export default function CoachSettingsScreen({ state, updateState, onNavigate, onBack }) {
  const profile = resolveProfile(state);
  const currentSpecialty = getSpecialty(profile.coachSpecialty || "bodybuilding");

  const patch = (fields) => {
    updateState((prev) => ({ ...prev, athleteProfile: { ...resolveProfile(prev), ...fields, updatedAt: new Date().toISOString() } }));
  };

  const [connState, setConnState] = useState("idle"); // "idle" | "testing" | "connected" | "failed"
  const [connResult, setConnResult] = useState(null);

  // Production-incident tooling — tests the SAME deployed /api/coach-chat backend and
  // OPENAI_API_KEY the real Coach chat uses, layered: the server checks the provider/key/model
  // in isolation first, then streaming, and reports exactly which layer failed rather than
  // collapsing everything into one generic result.
  const testConnection = async () => {
    setConnState("testing");
    setConnResult(null);
    try {
      const res = await fetch("/api/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionTest: true }),
      });
      const body = await res.json().catch(() => null);
      if (body?.ok) {
        setConnState("connected");
        setConnResult({ model: body.model, requestId: body.requestId });
      } else {
        setConnState("failed");
        setConnResult({ reason: body?.reason || body?.error || "Unknown failure.", layer: body?.layer, model: body?.model, requestId: body?.requestId });
      }
    } catch {
      setConnState("failed");
      setConnResult({ reason: "Network request to BRK's own backend failed.", requestId: null });
    }
  };

  const clearMemory = () => {
    const ok = window.confirm(
      "Clear everything Coach has learned from conversations and detected patterns? Your workout history, goals, and logged data are never touched — this only resets Coach's own memory and chat history."
    );
    if (!ok) return;
    updateState((prev) => ({ ...prev, coachMemories: [], coachHistory: [], coachConversations: [] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Coach</div>
          <div className="text-xl font-bold text-white mt-1">Coach settings</div>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            ← Back
          </button>
        )}
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext">Coach specialty</label>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext/70">Current</div>
          <div className="text-base font-bold text-white">{currentSpecialty.label}</div>
          <div className="text-xs text-v5-subtext mt-0.5">{currentSpecialty.subtitle}</div>
        </div>
        {profile.coachSpecialty === "bodybuilding" && (profile.physiquePhase || profile.physiquePriorities?.primary) && (
          <div className="text-[11px] text-v5-subtext pt-2 border-t border-white/10 space-y-0.5">
            {profile.physiquePhase && (
              <div>
                Current phase: <span className="text-white font-bold">{PHYSIQUE_PHASE_LABEL[profile.physiquePhase]}</span>
              </div>
            )}
            {profile.physiquePriorities?.primary && (
              <div>
                Primary focus: <span className="text-white font-bold">{profile.physiquePriorities.primary}</span>
              </div>
            )}
            {profile.physiquePriorities?.secondary && (
              <div>
                Secondary: <span className="text-white font-bold">{profile.physiquePriorities.secondary}</span>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => onNavigate?.("coachSelect")}
          className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-v5-red text-v5-red hover:bg-v5-red/30"
        >
          Change Coach
        </button>
      </div>

      <button
        onClick={() => onNavigate?.("developmentPriorities")}
        className="w-full flex items-center justify-between border border-white/10 bg-v5-elevated p-4 hover:border-v5-red"
      >
        <div className="text-left">
          <div className="text-sm font-bold text-white">Development Priorities</div>
          <div className="text-xs text-v5-subtext mt-0.5">Which muscle groups matter most to you</div>
        </div>
        <ChevronRight size={18} className="text-v5-subtext/70 shrink-0" />
      </button>

      {profile.coachSpecialty === "bodybuilding" && (
        <>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Current phase</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PHYSIQUE_PHASES.map((p) => (
                <button
                  key={p}
                  onClick={() => patch({ physiquePhase: p })}
                  className={`py-2 px-2 text-[11px] font-bold uppercase tracking-wide border ${
                    (profile.physiquePhase || "general_hypertrophy") === p
                      ? "bg-v5-red border-v5-red text-white"
                      : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                  }`}
                >
                  {PHYSIQUE_PHASE_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Weak point focus</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-v5-subtext/70 mb-1">Primary</div>
                <select
                  value={profile.physiquePriorities?.primary || ""}
                  onChange={(e) =>
                    patch({ physiquePriorities: { ...profile.physiquePriorities, primary: e.target.value || null } })
                  }
                  className="w-full bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red"
                >
                  <option value="">None set</option>
                  {PHYSIQUE_PRIORITY_MUSCLES.map((m) => (
                    <option key={m} value={m} disabled={m === profile.physiquePriorities?.secondary}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[11px] text-v5-subtext/70 mb-1">Secondary</div>
                <select
                  value={profile.physiquePriorities?.secondary || ""}
                  onChange={(e) =>
                    patch({ physiquePriorities: { ...profile.physiquePriorities, secondary: e.target.value || null } })
                  }
                  className="w-full bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red"
                >
                  <option value="">None set</option>
                  {PHYSIQUE_PRIORITY_MUSCLES.map((m) => (
                    <option key={m} value={m} disabled={m === profile.physiquePriorities?.primary}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-2">How should Coach talk to you?</label>
        <div className="space-y-1.5">
          {COACHING_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => patch({ coachingStyle: s })}
              className={`w-full text-left px-3 py-2.5 border ${
                profile.coachingStyle === s ? "border-v5-red bg-v5-red/20" : "border-white/10 hover:border-v5-red/40"
              }`}
            >
              <div className={`text-sm font-bold ${profile.coachingStyle === s ? "text-white" : "text-v5-text/90"}`}>{COACHING_STYLE_LABEL[s]}</div>
              <div className="text-xs text-v5-subtext mt-0.5">{COACHING_STYLE_DESC[s]}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Response length</label>
        <div className="flex gap-2">
          {RESPONSE_LENGTHS.map((r) => (
            <button
              key={r}
              onClick={() => patch({ responseLength: r })}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                profile.responseLength === r ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext"
              }`}
            >
              {RESPONSE_LENGTH_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">Learn from my training data</div>
            <div className="text-xs text-v5-subtext mt-0.5">When off, Coach stops detecting new patterns. Existing memories stay until you delete them.</div>
          </div>
          <button
            onClick={() => patch({ learningEnabled: !profile.learningEnabled })}
            className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${profile.learningEnabled ? "bg-v5-red" : "bg-v5-elevated"}`}
            aria-label="Toggle learning from training data"
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.learningEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <button onClick={() => onNavigate?.("coachKnowledge")} className="w-full flex items-center justify-between border border-white/10 bg-v5-elevated p-3 text-sm text-v5-text/90 hover:border-v5-red/40">
          What Coach knows about you
          <ChevronRight size={16} className="text-v5-subtext/70" />
        </button>
        <button onClick={() => onNavigate?.("coachProfile")} className="w-full flex items-center justify-between border border-white/10 bg-v5-elevated p-3 text-sm text-v5-text/90 hover:border-v5-red/40">
          Edit full athlete profile
          <ChevronRight size={16} className="text-v5-subtext/70" />
        </button>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">AI Connection</div>

        {connState === "idle" && (
          <button onClick={testConnection} className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-v5-red text-v5-red hover:bg-v5-red/30">
            Test Connection
          </button>
        )}

        {connState === "testing" && <div className="text-sm text-v5-subtext">Testing…</div>}

        {connState === "connected" && (
          <div className="space-y-1.5">
            <div className="text-sm font-bold text-green-500">CONNECTED</div>
            <div className="text-xs text-v5-subtext">
              Model: <span className="text-v5-text/90">{connResult?.model}</span>
            </div>
            <button onClick={testConnection} className="text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red">
              Test again
            </button>
          </div>
        )}

        {connState === "failed" && (
          <div className="space-y-1.5">
            <div className="text-sm font-bold text-v5-red">FAILED</div>
            <div className="text-xs text-v5-subtext">Reason: {connResult?.reason}</div>
            {connResult?.requestId && <div className="text-[11px] text-v5-subtext/70">Error ID: {connResult.requestId}</div>}
            <button onClick={testConnection} className="text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red">
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="border border-white/10 p-4 space-y-2">
        <div className="text-sm font-bold text-white">Clear conversation memory</div>
        <div className="text-xs text-v5-subtext">Resets everything Coach has learned from conversations and detected patterns. Your workout history, goals, and logs are never affected.</div>
        <button onClick={clearMemory} className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-v5-red/25 text-v5-red hover:bg-v5-red/30">
          Clear conversation memory
        </button>
      </div>
    </div>
  );
}
