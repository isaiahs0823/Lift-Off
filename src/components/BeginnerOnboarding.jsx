import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { recommendForBeginner, trainingDetailForExperience } from "../utils/beginnerRecommendation.js";
import { ButtonPrimary, ButtonText, Card, SectionLabel } from "./ui/Kit.jsx";
import ExerciseInstructionPanel from "./ExerciseInstructionPanel.jsx";

const STEPS = ["welcome", "experience", "goal", "days", "equipment", "recommendation"];

const EXPERIENCE_OPTIONS = [
  { value: "new", label: "I'm just getting started" },
  { value: "some", label: "I've worked out before" },
  { value: "experienced", label: "I'm experienced and have my own routine" },
];
const GOAL_OPTIONS = [
  { value: "muscle", label: "Build muscle" },
  { value: "strength", label: "Get stronger" },
  { value: "fitness", label: "Improve overall fitness" },
  { value: "fatloss", label: "Lose body fat while improving fitness" },
];
const DAYS_OPTIONS = [
  { value: 2, label: "2 days a week" },
  { value: 3, label: "3 days a week" },
  { value: 4, label: "4 days a week" },
  { value: 5, label: "5+ days a week" },
];
const EQUIPMENT_OPTIONS = [
  { value: "full", label: "Full gym" },
  { value: "home", label: "Home gym" },
  { value: "minimal", label: "Minimal equipment" },
  { value: "unsure", label: "Not sure yet" },
];

// One large tappable option row, shared by every question screen — consistent touch target size
// (py-4, full width) across the whole flow, matching the brief's "avoid dropdowns, use large
// obvious interaction targets" instruction.
function OptionList({ options, value, onSelect }) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`w-full text-left py-4 px-4 rounded-xl border transition-colors ${
              active
                ? "border-v5-red bg-v5-red/10 text-v5-text"
                : "border-white/10 bg-v5-elevated text-v5-text/90 hover:border-white/20"
            }`}
          >
            <span className="text-sm font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StepDots({ stepIndex, total }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? "w-5 bg-v5-red" : "w-1.5 bg-v5-muted"}`} />
      ))}
    </div>
  );
}

// Replaces the old flat OnboardingView for a genuinely fresh install (App.jsx's
// `!state.hasSeenOnboarding` gate — unchanged). Welcome -> 4 questions -> one recommendation,
// each question on its own screen (progressive disclosure, not one overwhelming form). Answers
// live in local component state until "Accept Plan" — nothing is written to persisted app state
// until the athlete actually commits to a plan, so an abandoned/refreshed mid-flow never leaves
// partial preferences behind.
//
// Never touches an existing athlete: this component is only ever mounted while
// `hasSeenOnboarding` is false, which App.jsx's initialization already guarantees can only be
// true for a genuinely fresh install (see persistence/initialization.js's migrateCanonicalData,
// which backfills hasSeenOnboarding=true for any account with existing logs/programs/currentProgram).
export default function BeginnerOnboardingFlow({ state, updateState, onStartRun, onGoToTemplates }) {
  const [step, setStep] = useState("welcome");
  const [answers, setAnswers] = useState({ experience: null, goal: null, days: null, equipment: null });

  const stepIndex = STEPS.indexOf(step);
  const goNext = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]);
  const goBack = () => setStep(STEPS[Math.max(stepIndex - 1, 0)]);

  // "I already have a training plan" — the brief's required obvious advanced-user bypass. Skips
  // every question; routes straight to the existing program browser. Never forces a beginner
  // setup an experienced athlete didn't ask for.
  const bypassToOwnPlan = () => {
    updateState((prev) => ({ ...prev, hasSeenOnboarding: true }));
    onGoToTemplates();
  };

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    goNext();
  };

  const recommendation =
    step === "recommendation" && answers.days
      ? recommendForBeginner(answers, { programs: state.programs || [] })
      : null;

  // Accept Plan: the one place beginner onboarding ever writes to persisted state. Sets
  // hasSeenOnboarding (so this flow can never show again — the same sticky-latch rule every other
  // entry point into hasSeenOnboarding already follows), records the raw answers for reference,
  // and sets settings.trainingDetail based on self-reported experience ONLY for this fresh
  // account's own settings object — see beginnerRecommendation.js's trainingDetailForExperience
  // and the Stage 1 plan's persistence-risk note: this can never touch an existing athlete's
  // settings, because this component only ever mounts pre-hasSeenOnboarding.
  const acceptPlan = () => {
    if (!recommendation?.program) return;
    const { program } = recommendation;
    updateState((prev) => ({
      ...prev,
      hasSeenOnboarding: true,
      beginnerOnboarding: { ...answers, completedAt: new Date().toISOString() },
      settings: { ...(prev.settings || {}), trainingDetail: trainingDetailForExperience(answers.experience) },
    }));
    onStartRun(
      { name: `${program.name} — ${program.days[0].label}`, exercises: program.days[0].exercises },
      { programId: program.id, programName: program.name, source: "builtin", dayIndex: 0, totalDays: program.days.length }
    );
  };

  if (step === "welcome") {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="space-y-3">
          <div className="text-2xl font-black text-v5-text">Let's build your training routine.</div>
          <p className="text-sm text-v5-subtext max-w-sm mx-auto leading-relaxed">
            Answer a few quick questions. We'll help you find a starting plan and walk you through your first workout.
          </p>
        </div>
        <ButtonPrimary size="lg" onClick={goNext}>
          Get Started
        </ButtonPrimary>
        <button onClick={bypassToOwnPlan} className="block w-full text-center text-xs text-v5-subtext hover:text-v5-text py-2">
          I already have a training plan
        </button>
      </div>
    );
  }

  if (step === "recommendation") {
    if (!recommendation) return null;
    const { program, reasonLines, equipmentGap, gap } = recommendation;
    if (!program) {
      return (
        <div className="space-y-4 text-center py-4">
          <p className="text-sm text-v5-subtext">
            We couldn't find a ready-made plan for that exact combination yet. Browse the full program list to pick one yourself.
          </p>
          <ButtonPrimary size="lg" onClick={onGoToTemplates}>
            Browse all programs
          </ButtonPrimary>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <StepDots stepIndex={stepIndex} total={STEPS.length} />
        <div className="text-center space-y-1 pt-1">
          <SectionLabel>Your recommended plan</SectionLabel>
          <div className="text-xl font-black text-v5-text">{program.name}</div>
        </div>
        <Card className="space-y-2">
          {reasonLines.map((line, i) => (
            <p key={i} className={`text-sm ${i === 0 ? "text-v5-text font-medium" : "text-v5-subtext"}`}>
              {line}
            </p>
          ))}
          {gap && <p className="text-xs text-v5-red/90 pt-1">{gap}</p>}
          {equipmentGap && <p className="text-xs text-v5-subtext/80 pt-1">{equipmentGap}</p>}
        </Card>

        {/* First-exercise preview, using the real Stage 2B instruction panel — proves the
            architecture end-to-end rather than leaving it unused until the logger screen. */}
        {program.days[0]?.exercises?.[0] && (
          <ExerciseInstructionPanel exId={program.days[0].exercises[0].exId} exerciseName="your first exercise" compact />
        )}

        <ButtonPrimary size="lg" onClick={acceptPlan}>
          Start My First Workout
        </ButtonPrimary>
        <div className="flex items-center justify-center gap-4 pt-1">
          <ButtonText tone="muted" onClick={onGoToTemplates}>
            See other plans
          </ButtonText>
          <ButtonText tone="muted" onClick={bypassToOwnPlan}>
            I have my own plan
          </ButtonText>
        </div>
      </div>
    );
  }

  const QUESTION_CONFIG = {
    experience: { prompt: "How familiar are you with the gym?", options: EXPERIENCE_OPTIONS, key: "experience" },
    goal: { prompt: "What's your main goal?", options: GOAL_OPTIONS, key: "goal" },
    days: { prompt: "How many days per week can you realistically train?", options: DAYS_OPTIONS, key: "days" },
    equipment: { prompt: "Where do you usually train?", options: EQUIPMENT_OPTIONS, key: "equipment" },
  };
  const q = QUESTION_CONFIG[step];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={goBack} className="text-v5-subtext hover:text-v5-text p-1 -ml-1" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <StepDots stepIndex={stepIndex} total={STEPS.length} />
        <div className="w-7" />
      </div>
      <div className="text-lg font-bold text-v5-text text-center px-2">{q.prompt}</div>
      {step === "days" && (
        <p className="text-xs text-v5-subtext text-center -mt-2">Consistency matters more than picking the highest number.</p>
      )}
      <OptionList options={q.options} value={answers[q.key]} onSelect={(v) => setAnswer(q.key, v)} />
    </div>
  );
}
