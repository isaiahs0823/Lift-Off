import MuscleBodyOutline from "./MuscleBodyOutline.jsx";

// Internal-only visual QA aid for the anatomy system — renders one MuscleBodyOutline per major
// zone side by side so a real render regression (wrong highlight, clipped figure, broken view)
// is obvious at a glance without manually stepping through the exercise catalog in the app.
// Not linked from any nav, button, or normal app flow — only reachable by loading the app with
// ?devAnatomy=1 in the URL (see main.jsx). Uses synthetic {name, muscle} objects, the same shape
// getMuscleDisplay reads off a real or custom exercise, so this exercises the identical code path
// the live app uses, not a special case.
const SAMPLES = [
  { label: "Chest", exercise: { name: "Barbell bench press", muscle: "Chest" } },
  { label: "Back", exercise: { name: "Barbell row", muscle: "Back" } },
  { label: "Shoulders", exercise: { name: "Overhead press", muscle: "Shoulders" } },
  { label: "Biceps", exercise: { name: "Barbell curl", muscle: "Arms" } },
  { label: "Triceps", exercise: { name: "Tricep pushdown", muscle: "Arms" } },
  { label: "Forearms", exercise: { name: "Wrist curl", muscle: "Arms" } },
  { label: "Quads", exercise: { name: "Back squat", muscle: "Legs" } },
  { label: "Hamstrings", exercise: { name: "Lying leg curl", muscle: "Legs" } },
  { label: "Glutes", exercise: { name: "Barbell hip thrust", muscle: "Legs" } },
  { label: "Calves", exercise: { name: "Standing calf raise", muscle: "Legs" } },
  { label: "Core", exercise: { name: "Cable crunch", muscle: "Core" } },
  { label: "Full body (fallback)", exercise: { name: "Unmapped custom exercise", muscle: "Conditioning" } },
];

export default function DevAnatomyShowcase() {
  return (
    <div style={{ background: "#151515", minHeight: "100vh", padding: 24, color: "#e5e5e5", fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#dc2626", marginBottom: 4 }}>
        Internal QA — not linked in the app
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Anatomy System Showcase</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 20 }}>
        {SAMPLES.map(({ label, exercise }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <MuscleBodyOutline exercise={exercise} size={64} />
            <div style={{ fontSize: 12, textAlign: "center", color: "#a3a3a3" }}>{label}</div>
            <div style={{ fontSize: 10, textAlign: "center", color: "#525252" }}>{exercise.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
