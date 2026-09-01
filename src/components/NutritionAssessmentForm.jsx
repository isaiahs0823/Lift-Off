import React, { useState } from "react";
import { X } from "lucide-react";
import {
  resolveNutritionProfile,
  NUTRITION_GOALS,
  NUTRITION_GOAL_LABEL,
  OCCUPATION_ACTIVITY_LEVELS,
  OCCUPATION_ACTIVITY_LABEL,
  COOKING_ABILITY_LEVELS,
  COOKING_ABILITY_LABEL,
  MEAL_PREP_WILLINGNESS_LEVELS,
  MEAL_PREP_WILLINGNESS_LABEL,
  BUDGET_LEVELS,
  BUDGET_LEVEL_LABEL,
  REALISTIC_ADHERENCE_OPTIONS,
  REALISTIC_ADHERENCE_LABEL,
  ADHERENCE_BARRIERS,
  ADHERENCE_BARRIER_LABEL,
  CONTROL_LEVELS,
  CONTROL_LEVEL_LABEL,
  CONTROL_LEVEL_DESC,
  RECENT_WEIGHT_TREND_OPTIONS,
  RECENT_WEIGHT_TREND_LABEL,
} from "../utils/nutrition.js";
import { calculateNutritionTargets, currentBodyweightLbs } from "../utils/nutritionMath.js";

function TagList({ items, onAdd, onRemove, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = (val) => {
    const trimmed = val.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onAdd(trimmed);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="flex items-center gap-1 px-2.5 py-1 text-xs border border-white/10 text-v5-text/90 bg-v5-surface">
              {item}
              <button onClick={() => onRemove(item)} className="text-v5-subtext/70 hover:text-v5-red">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(draft)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
        <button onClick={() => add(draft)} className="shrink-0 px-3 py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
          Add
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-v5-subtext/70 mt-1">{hint}</p>}
    </div>
  );
}

function TextInput(props) {
  return <input {...props} className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red" />;
}

function ChipGroup({ options, value, labelMap, onChange, columns = 2 }) {
  return (
    <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`py-2.5 px-2 text-[11px] font-bold uppercase tracking-wide border ${
            value === opt ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
          }`}
        >
          {labelMap[opt]}
        </button>
      ))}
    </div>
  );
}

// Section 2/3/7 of the nutrition spec: a conversational, multi-step assessment — not "what do
// you want your calories to be?" — that gathers enough real context to make an informed
// starting recommendation, then explicitly asks whether the athlete can actually execute it
// (section 3, "the most important question") before Coach ever proposes a number.
export default function NutritionAssessmentForm({ state, updateState, onDone }) {
  const existing = resolveNutritionProfile(state);
  const weightLbs = currentBodyweightLbs(state);

  const [step, setStep] = useState(0);
  const [age, setAge] = useState(existing.age ?? "");
  const [sex, setSex] = useState(existing.sex);
  const [heightIn, setHeightIn] = useState(existing.heightIn ?? "");
  const [goalWeight, setGoalWeight] = useState(existing.goalWeight ?? "");
  const [bodyFatPct, setBodyFatPct] = useState(existing.bodyFatPct ?? "");
  const [primaryGoal, setPrimaryGoal] = useState(existing.primaryGoal);

  const [resistanceFrequency, setResistanceFrequency] = useState(existing.resistanceFrequency ?? "");
  const [cardioFrequency, setCardioFrequency] = useState(existing.cardioFrequency ?? "");
  const [cardioType, setCardioType] = useState(existing.cardioType);
  const [cardioDurationMin, setCardioDurationMin] = useState(existing.cardioDurationMin ?? "");
  const [occupationActivity, setOccupationActivity] = useState(existing.occupationActivity);
  const [dailySteps, setDailySteps] = useState(existing.dailySteps ?? "");

  const [wakeTime, setWakeTime] = useState(existing.wakeTime);
  const [bedTime, setBedTime] = useState(existing.bedTime);
  const [workSchedule, setWorkSchedule] = useState(existing.workSchedule);
  const [trainingTime, setTrainingTime] = useState(existing.trainingTime);

  const [dietaryRestrictions, setDietaryRestrictions] = useState(existing.dietaryRestrictions);
  const [allergies, setAllergies] = useState(existing.allergies);
  const [dislikedFoods, setDislikedFoods] = useState(existing.dislikedFoods);
  const [preferredFoods, setPreferredFoods] = useState(existing.preferredFoods);

  const [cookingAbility, setCookingAbility] = useState(existing.cookingAbility);
  const [mealPrepWillingness, setMealPrepWillingness] = useState(existing.mealPrepWillingness);
  const [mealsPerDayPreference, setMealsPerDayPreference] = useState(existing.mealsPerDayPreference ?? "");
  const [eatingOutFrequency, setEatingOutFrequency] = useState(existing.eatingOutFrequency ?? "");
  const [weekdayEatingNotes, setWeekdayEatingNotes] = useState(existing.weekdayEatingNotes);
  const [weekendEatingNotes, setWeekendEatingNotes] = useState(existing.weekendEatingNotes);
  const [alcoholFrequency, setAlcoholFrequency] = useState(existing.alcoholFrequency);
  const [budgetLevel, setBudgetLevel] = useState(existing.budgetLevel);
  const [householdConsiderations, setHouseholdConsiderations] = useState(existing.householdConsiderations);

  const [currentCalorieIntake, setCurrentCalorieIntake] = useState(existing.currentCalorieIntake ?? "");
  const [currentMacroIntake, setCurrentMacroIntake] = useState(existing.currentMacroIntake);
  const [recentWeightTrend, setRecentWeightTrend] = useState(existing.recentWeightTrend);
  const [dietingExperience, setDietingExperience] = useState(existing.dietingExperience);
  const [biggestDifficulty, setBiggestDifficulty] = useState(existing.biggestDifficulty);

  const [realisticAdherence, setRealisticAdherence] = useState(existing.realisticAdherence);
  const [adherenceBarriers, setAdherenceBarriers] = useState(existing.adherenceBarriers);
  const [controlLevel, setControlLevel] = useState(existing.controlLevel);

  const toggleBarrier = (b) => setAdherenceBarriers((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  const buildProfile = () => ({
    ...existing,
    age: age !== "" ? Number(age) : null,
    sex,
    heightIn: heightIn !== "" ? Number(heightIn) : null,
    goalWeight: goalWeight !== "" ? Number(goalWeight) : null,
    bodyFatPct: bodyFatPct !== "" ? Number(bodyFatPct) : null,
    primaryGoal,
    resistanceFrequency: resistanceFrequency !== "" ? Number(resistanceFrequency) : null,
    cardioFrequency: cardioFrequency !== "" ? Number(cardioFrequency) : null,
    cardioType,
    cardioDurationMin: cardioDurationMin !== "" ? Number(cardioDurationMin) : null,
    occupationActivity,
    dailySteps: dailySteps !== "" ? Number(dailySteps) : null,
    wakeTime,
    bedTime,
    workSchedule,
    trainingTime,
    dietaryRestrictions,
    allergies,
    dislikedFoods,
    preferredFoods,
    cookingAbility,
    mealPrepWillingness,
    mealsPerDayPreference: mealsPerDayPreference !== "" ? Number(mealsPerDayPreference) : null,
    eatingOutFrequency: eatingOutFrequency !== "" ? Number(eatingOutFrequency) : null,
    weekdayEatingNotes,
    weekendEatingNotes,
    alcoholFrequency,
    budgetLevel,
    householdConsiderations,
    currentCalorieIntake: currentCalorieIntake !== "" ? Number(currentCalorieIntake) : null,
    currentMacroIntake,
    recentWeightTrend,
    dietingExperience,
    biggestDifficulty,
    realisticAdherence,
    adherenceBarriers,
    controlLevel,
  });

  const [generatedTargets, setGeneratedTargets] = useState(null);

  const finishAssessment = () => {
    const profile = buildProfile();
    const targets = calculateNutritionTargets(profile, weightLbs);
    updateState((prev) => ({
      ...prev,
      nutritionProfile: {
        ...profile,
        onboardedAt: prev.nutritionProfile?.onboardedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      nutritionTargets: targets
        ? {
            ...targets,
            createdAt: prev.nutritionTargets?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sameDailyTargets: true,
            history: [
              ...(prev.nutritionTargets?.history || []),
              { date: new Date().toISOString(), calories: targets.calories, protein: targets.protein, carbs: targets.carbs, fat: targets.fat, reason: "Initial assessment" },
            ],
          }
        : prev.nutritionTargets,
    }));
    setGeneratedTargets(targets);
    setStep(steps.length); // move to results screen
  };

  const steps = [
    {
      title: "About you",
      body: (
        <div className="space-y-4">
          <p className="text-sm text-v5-subtext">Before I give you numbers, I need to understand how you actually live.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <TextInput type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 29" />
            </Field>
            <Field label="Height (in)">
              <TextInput type="number" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} placeholder="e.g. 70" />
            </Field>
          </div>
          <Field label="Sex" hint="Used only for the resting-energy calculation.">
            <ChipGroup options={["male", "female", "unspecified"]} value={sex} labelMap={{ male: "Male", female: "Female", unspecified: "Prefer not to say" }} onChange={setSex} columns={3} />
          </Field>
          {!weightLbs && (
            <p className="text-xs text-amber-500">No bodyweight logged yet — log a bodyweight entry in Progress so Coach can calculate real numbers.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Goal weight" hint="Optional">
              <TextInput type="number" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} placeholder="lbs" />
            </Field>
            <Field label="Body fat %" hint="Optional, estimate is fine">
              <TextInput type="number" value={bodyFatPct} onChange={(e) => setBodyFatPct(e.target.value)} placeholder="e.g. 18" />
            </Field>
          </div>
        </div>
      ),
    },
    {
      title: "Goal",
      body: (
        <Field label="Primary goal">
          <div className="space-y-1.5">
            {NUTRITION_GOALS.map((g) => (
              <button
                key={g}
                onClick={() => setPrimaryGoal(g)}
                className={`w-full text-left px-3 py-2.5 border ${primaryGoal === g ? "border-v5-red bg-v5-red/20 text-white" : "border-white/10 text-v5-text/90 hover:border-v5-red/40"}`}
              >
                {NUTRITION_GOAL_LABEL[g]}
              </button>
            ))}
          </div>
        </Field>
      ),
    },
    {
      title: "Training & activity",
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Resistance sessions/wk">
              <TextInput type="number" value={resistanceFrequency} onChange={(e) => setResistanceFrequency(e.target.value)} placeholder="e.g. 4" />
            </Field>
            <Field label="Cardio sessions/wk">
              <TextInput type="number" value={cardioFrequency} onChange={(e) => setCardioFrequency(e.target.value)} placeholder="e.g. 2" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cardio type" hint="Optional">
              <TextInput type="text" value={cardioType} onChange={(e) => setCardioType(e.target.value)} placeholder="e.g. Incline walk" />
            </Field>
            <Field label="Cardio duration (min)" hint="Optional">
              <TextInput type="number" value={cardioDurationMin} onChange={(e) => setCardioDurationMin(e.target.value)} placeholder="e.g. 30" />
            </Field>
          </div>
          <Field label="Occupation activity level">
            <ChipGroup options={OCCUPATION_ACTIVITY_LEVELS} value={occupationActivity} labelMap={OCCUPATION_ACTIVITY_LABEL} onChange={setOccupationActivity} columns={1} />
          </Field>
          <Field label="Approximate daily steps" hint="Optional, if you know it">
            <TextInput type="number" value={dailySteps} onChange={(e) => setDailySteps(e.target.value)} placeholder="e.g. 7000" />
          </Field>
        </div>
      ),
    },
    {
      title: "Schedule",
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Normal wake time">
              <TextInput type="text" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} placeholder="e.g. 6:00 AM" />
            </Field>
            <Field label="Normal bedtime">
              <TextInput type="text" value={bedTime} onChange={(e) => setBedTime(e.target.value)} placeholder="e.g. 10:30 PM" />
            </Field>
          </div>
          <Field label="Work schedule" hint="Optional">
            <TextInput type="text" value={workSchedule} onChange={(e) => setWorkSchedule(e.target.value)} placeholder="e.g. 12-hour shifts, rotating" />
          </Field>
          <Field label="Usual training time" hint="Optional">
            <TextInput type="text" value={trainingTime} onChange={(e) => setTrainingTime(e.target.value)} placeholder="e.g. 5:30 PM after work" />
          </Field>
        </div>
      ),
    },
    {
      title: "Food preferences",
      body: (
        <div className="space-y-4">
          <Field label="Dietary restrictions" hint="Optional">
            <TagList items={dietaryRestrictions} onAdd={(v) => setDietaryRestrictions((p) => [...p, v])} onRemove={(v) => setDietaryRestrictions((p) => p.filter((x) => x !== v))} placeholder="e.g. Vegetarian" />
          </Field>
          <Field label="Allergies" hint="Optional">
            <TagList items={allergies} onAdd={(v) => setAllergies((p) => [...p, v])} onRemove={(v) => setAllergies((p) => p.filter((x) => x !== v))} placeholder="e.g. Shellfish" />
          </Field>
          <Field label="Foods you strongly dislike" hint="Optional">
            <TagList items={dislikedFoods} onAdd={(v) => setDislikedFoods((p) => [...p, v])} onRemove={(v) => setDislikedFoods((p) => p.filter((x) => x !== v))} placeholder="e.g. Fish" />
          </Field>
          <Field label="Foods you strongly prefer" hint="Optional">
            <TagList items={preferredFoods} onAdd={(v) => setPreferredFoods((p) => [...p, v])} onRemove={(v) => setPreferredFoods((p) => p.filter((x) => x !== v))} placeholder="e.g. Chicken, rice" />
          </Field>
        </div>
      ),
    },
    {
      title: "Cooking & logistics",
      body: (
        <div className="space-y-4">
          <Field label="Cooking ability">
            <ChipGroup options={COOKING_ABILITY_LEVELS} value={cookingAbility} labelMap={COOKING_ABILITY_LABEL} onChange={setCookingAbility} columns={1} />
          </Field>
          <Field label="Meal-prep willingness">
            <ChipGroup options={MEAL_PREP_WILLINGNESS_LEVELS} value={mealPrepWillingness} labelMap={MEAL_PREP_WILLINGNESS_LABEL} onChange={setMealPrepWillingness} columns={1} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meals/day preference" hint="Optional">
              <TextInput type="number" value={mealsPerDayPreference} onChange={(e) => setMealsPerDayPreference(e.target.value)} placeholder="e.g. 3" />
            </Field>
            <Field label="Eating out (times/wk)" hint="Optional">
              <TextInput type="number" value={eatingOutFrequency} onChange={(e) => setEatingOutFrequency(e.target.value)} placeholder="e.g. 2" />
            </Field>
          </div>
          <Field label="Budget considerations">
            <ChipGroup options={BUDGET_LEVELS} value={budgetLevel} labelMap={BUDGET_LEVEL_LABEL} onChange={setBudgetLevel} columns={1} />
          </Field>
          <Field label="Typical weekday eating" hint="Optional">
            <TextInput type="text" value={weekdayEatingNotes} onChange={(e) => setWeekdayEatingNotes(e.target.value)} placeholder="e.g. Skip breakfast, eat late" />
          </Field>
          <Field label="Typical weekend eating" hint="Optional">
            <TextInput type="text" value={weekendEatingNotes} onChange={(e) => setWeekendEatingNotes(e.target.value)} placeholder="e.g. Eat out both days" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alcohol frequency" hint="Optional">
              <TextInput type="text" value={alcoholFrequency} onChange={(e) => setAlcoholFrequency(e.target.value)} placeholder="e.g. Weekends" />
            </Field>
            <Field label="Household considerations" hint="Optional">
              <TextInput type="text" value={householdConsiderations} onChange={(e) => setHouseholdConsiderations(e.target.value)} placeholder="e.g. Cooking for family of 4" />
            </Field>
          </div>
        </div>
      ),
    },
    {
      title: "Current baseline",
      body: (
        <div className="space-y-4">
          <p className="text-xs text-v5-subtext">All optional — only fill in what you actually know.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current calorie intake" hint="If known">
              <TextInput type="number" value={currentCalorieIntake} onChange={(e) => setCurrentCalorieIntake(e.target.value)} placeholder="e.g. 2600" />
            </Field>
            <Field label="Current macros" hint="If known">
              <TextInput type="text" value={currentMacroIntake} onChange={(e) => setCurrentMacroIntake(e.target.value)} placeholder="e.g. ~180p/300c/80f" />
            </Field>
          </div>
          <Field label="Recent bodyweight trend">
            <ChipGroup options={RECENT_WEIGHT_TREND_OPTIONS} value={recentWeightTrend} labelMap={RECENT_WEIGHT_TREND_LABEL} onChange={setRecentWeightTrend} columns={2} />
          </Field>
          <Field label="Previous dieting experience" hint="Optional">
            <TextInput type="text" value={dietingExperience} onChange={(e) => setDietingExperience(e.target.value)} placeholder="e.g. Tried keto, didn't stick" />
          </Field>
          <Field label="Biggest nutrition difficulty" hint="Optional">
            <TextInput type="text" value={biggestDifficulty} onChange={(e) => setBiggestDifficulty(e.target.value)} placeholder="e.g. Late-night snacking" />
          </Field>
        </div>
      ),
    },
    {
      title: "The important question",
      highlight: true,
      body: (
        <div className="space-y-4">
          <p className="text-sm text-white font-bold">Now forget the perfect version of your week.</p>
          <p className="text-sm text-v5-text/90">Think about how you actually live. Can you realistically follow this structure most days?</p>
          <div className="space-y-1.5">
            {REALISTIC_ADHERENCE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setRealisticAdherence(opt)}
                className={`w-full text-left px-3 py-2.5 border ${realisticAdherence === opt ? "border-v5-red bg-v5-red/20 text-white" : "border-white/10 text-v5-text/90 hover:border-v5-red/40"}`}
              >
                {REALISTIC_ADHERENCE_LABEL[opt]}
              </button>
            ))}
          </div>
          {(realisticAdherence === "maybe" || realisticAdherence === "no") && (
            <div className="space-y-2">
              <p className="text-xs text-v5-subtext">What specifically makes it hard? Pick anything that applies — this changes the plan, not just a note.</p>
              <div className="flex flex-wrap gap-1.5">
                {ADHERENCE_BARRIERS.map((b) => (
                  <button
                    key={b}
                    onClick={() => toggleBarrier(b)}
                    className={`px-2.5 py-1.5 text-[11px] border ${adherenceBarriers.includes(b) ? "border-v5-red bg-v5-red/20 text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
                  >
                    {ADHERENCE_BARRIER_LABEL[b]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "How much structure?",
      body: (
        <div className="space-y-2">
          {CONTROL_LEVELS.map((c) => (
            <button
              key={c}
              onClick={() => setControlLevel(c)}
              className={`w-full text-left px-3 py-2.5 border ${controlLevel === c ? "border-v5-red bg-v5-red/20" : "border-white/10 hover:border-v5-red/40"}`}
            >
              <div className={`text-sm font-bold ${controlLevel === c ? "text-white" : "text-v5-text/90"}`}>{CONTROL_LEVEL_LABEL[c]}</div>
              <div className="text-xs text-v5-subtext mt-0.5">{CONTROL_LEVEL_DESC[c]}</div>
            </button>
          ))}
        </div>
      ),
    },
  ];

  if (step >= steps.length) {
    const targets = generatedTargets;
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Here's where I'd start</div>
        </div>
        {!targets ? (
          <p className="text-sm text-amber-500">
            I need at least age, sex, height, and a logged bodyweight entry to calculate real numbers. Log a bodyweight in Progress, then update this in Nutrition Settings.
          </p>
        ) : (
          <>
            <p className="text-sm text-v5-subtext">
              Based on your goal, activity, and current bodyweight — this is an <span className="text-white font-bold">estimate</span>, not a known fact. We'll refine it from what actually happens.
            </p>
            <div className="border border-white/10 bg-v5-elevated p-4 space-y-1">
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Estimated maintenance</div>
              <div className="text-lg font-bold text-v5-text/90">{targets.estimatedMaintenance.toLocaleString()} kcal/day</div>
            </div>
            <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Starting target</div>
                <div className="text-2xl font-bold text-white">{targets.calories.toLocaleString()} kcal</div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-white">{targets.protein}g</div>
                  <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Protein</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{targets.carbs}g</div>
                  <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Carbs</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{targets.fat}g</div>
                  <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Fat</div>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Now the important question:</p>
              <p className="text-sm text-v5-text/90">Can you actually execute this with your real schedule?</p>
            </div>
          </>
        )}
        <button onClick={onDone} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
          Continue to Nutrition
        </button>
      </div>
    );
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition Assessment</div>
        <div className="text-xl font-bold text-white mt-1">{current.title}</div>
        <div className="text-[11px] text-v5-subtext/70 mt-1">
          Step {step + 1} of {steps.length}
        </div>
      </div>

      {current.body}

      <div className="flex gap-2">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
            Back
          </button>
        )}
        <button
          onClick={() => (isLast ? finishAssessment() : setStep((s) => s + 1))}
          className="flex-[2] py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
        >
          {isLast ? "See my starting numbers" : "Next"}
        </button>
      </div>
    </div>
  );
}
