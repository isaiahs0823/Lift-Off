import { it, expect, vi } from "vitest";
import StartWorkoutChoice from "../../components/StartWorkoutChoice.jsx";

function buttons(element) {
  if (!element || typeof element !== "object") return [];
  return [element.type === "button" ? element : [], ...[element.props?.children].flat(Infinity).flatMap(buttons)].flat();
}
function props(recovery) {
  return {
    state: {
      customPrograms: [{ id: "p", name: "Synthetic", days: [recovery
        ? { type: "recovery", label: "Recovery", routineId: "lower_body_recovery" }
        : { label: "Strength", exercises: [{ exId: "bench", sets: 3 }] }] }],
      currentProgram: { programId: "p", source: "custom", dayIndex: 0, totalDays: 1 },
    },
    onStartRun: vi.fn(), onStartRecovery: vi.fn(), onRepeatRecent: vi.fn(), onBack: vi.fn(),
  };
}
it("dispatches a recovery selection to the recovery runner without passing an undefined lifting plan", () => {
  const p = props(true), choices = buttons(StartWorkoutChoice(p));
  choices[0].props.onClick();
  expect(p.onStartRecovery).toHaveBeenCalledWith(expect.objectContaining({ id: "lower_body_recovery" }), expect.objectContaining({ programId: "p" }));
  expect(p.onStartRun).not.toHaveBeenCalled();
  expect(choices).toHaveLength(3);
});
it("keeps programmed, blank and repeat workout options working", () => {
  const p = props(false), choices = buttons(StartWorkoutChoice(p));
  choices.forEach((choice) => choice.props.onClick());
  expect(p.onStartRun).toHaveBeenNthCalledWith(1, expect.objectContaining({ exercises: [{ exId: "bench", sets: 3 }] }), expect.objectContaining({ programId: "p" }));
  expect(p.onStartRun).toHaveBeenNthCalledWith(2, { name: "Workout Today", exercises: [], source: "blank" });
  expect(p.onRepeatRecent).toHaveBeenCalledOnce();
  expect(p.onStartRecovery).not.toHaveBeenCalled();
});
