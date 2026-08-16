// ---------------- COACH TOOL RUNNER ----------------
// Bridges a tool-call name+args from the model to an actual result. Almost everything is a
// read via COACH_TOOL_EXECUTORS; saveMemory and proposeCommitment/proposeNutritionTargetChange
// need special handling because they touch state or need to hand a structured proposal back to
// the chat UI (rendered as an Accept/Modify/Decline card) rather than plain data.
import { COACH_TOOL_EXECUTORS } from "../utils/coachTools.js";
import { addStatedMemory, upsertObservedMemory } from "../utils/coachMemoryStore.js";

export function createToolRunner({ state, updateState, exMap, allExercises }) {
  return async function executeTool(name, args = {}) {
    if (name === "saveMemory") {
      const { category, text, source, tags = [] } = args;
      if (!category || !text || !source) return { saved: false, error: "Missing category/text/source." };
      updateState((prev) => {
        const memories = prev.coachMemories || [];
        const next =
          source === "stated"
            ? addStatedMemory(memories, { category, text, tags })
            : upsertObservedMemory(memories, { category, text, source, tags, key: null });
        return { ...prev, coachMemories: next };
      });
      return { saved: true };
    }

    if (name === "proposeCommitment") {
      // Never creates anything — the chat UI detects this shape on the tool result and renders
      // a confirm card; only an explicit accept calls the real createCommitment().
      return { proposalType: "commitment", proposal: args };
    }

    const executor = COACH_TOOL_EXECUTORS[name];
    if (!executor) return { error: `Unknown tool: ${name}` };
    try {
      const result = executor(state, exMap, allExercises, args);
      // proposeNutritionTargetChange already returns { applicable, proposal } — tag it the same
      // way as proposeCommitment so the UI's "does this tool result carry a proposal" check is
      // uniform across both write-adjacent tools.
      if (name === "proposeNutritionTargetChange" && result?.applicable) {
        return { ...result, proposalType: "nutrition_target_change" };
      }
      return result ?? {};
    } catch (e) {
      return { error: e?.message || "Tool execution failed." };
    }
  };
}
