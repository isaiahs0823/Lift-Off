// ---------------- COACH SPECIALTIES (registry) ----------------
// The catalog of coaching methodologies BRK Coach can operate under. Only "bodybuilding" is
// functional right now — see bodybuilding.js for the actual reasoning module. Everything else
// is a real, named future specialty shown as "Coming Soon" so the roadmap is honest and
// visible, never a fake option that silently falls back to Bodybuilding Coach.
//
// Deliberately just a flat catalog + one working module, not eight stub files — there is
// nothing to architect yet for a specialty with no logic. When a new specialty actually gets
// built, it gets its own file next to bodybuilding.js and a `status: "active"` flip here.

export const COACH_SPECIALTIES = [
  {
    id: "bodybuilding",
    label: "Bodybuilding",
    subtitle: "Hypertrophy · Physique · Progression",
    description: "Build muscle, improve your physique, manage fatigue, and progress your training.",
    status: "active",
  },
  {
    id: "hybrid",
    label: "Hybrid Athlete",
    subtitle: "Strength · Muscle · Endurance",
    description: "Designed to analyze lifting and conditioning together while managing recovery and interference between both.",
    status: "coming_soon",
  },
  {
    id: "powerlifting",
    label: "Powerlifting",
    subtitle: "Squat · Bench · Deadlift",
    description: "Built around competition-lift performance, technique, specificity, and peaking for a meet.",
    status: "coming_soon",
  },
  {
    id: "strongman",
    label: "Strongman",
    subtitle: "Strength · Events · Carries",
    description: "Built around maximal strength, loaded carries, and event-specific work capacity.",
    status: "coming_soon",
  },
  {
    id: "tactical",
    label: "Tactical / Fire",
    subtitle: "Strength · Work Capacity · Durability",
    description: "Built around strength and work capacity for demanding occupational performance.",
    status: "coming_soon",
  },
  {
    id: "endurance",
    label: "Endurance",
    subtitle: "Pace · Engine · Durability",
    description: "Built around distance, pace, and sustainable training load, with strength as supportive work.",
    status: "coming_soon",
  },
  {
    id: "athletic",
    label: "Athletic Performance",
    subtitle: "Strength · Speed · Power",
    description: "Built around relative strength, speed, and explosive power for sport performance.",
    status: "coming_soon",
  },
  {
    id: "general",
    label: "General Fitness",
    subtitle: "Strength · Health · Consistency",
    description: "Built around sustainable progression, general strength, and consistency — the most accessible coach.",
    status: "coming_soon",
  },
];

export function getSpecialty(id) {
  return COACH_SPECIALTIES.find((s) => s.id === id) || COACH_SPECIALTIES[0];
}
export function isSpecialtyActive(id) {
  return getSpecialty(id).status === "active";
}
