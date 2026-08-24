import { Target, Mountain, Dumbbell, UserCheck, BookOpen } from "lucide-react";

// Single source of truth for the "B.R.E.A.K. Meaning" brand page's copy. Nothing in
// BreakMeaningPage.jsx (or the More-tab entry point) should hard-code any of this wording
// directly — everything renders from this config so the brand copy can be replaced in one place
// once BRK finalizes its official B.R.E.A.K. definition.
//
// TEMPORARY CONTENT: the wording below is a placeholder pending BRK's official brand copy.

export const HERO_CONTENT = {
  eyebrow: "BRK",
  title: "B.R.E.A.K.",
  subtitle: "THE STANDARD.",
  quote: "B.R.E.A.K. is more than a name.\nIt's the standard we live by.",
};

export const BREAK_VALUES = [
  {
    letter: "B",
    word: "Belief",
    description: "Believe in the process, your plan, and yourself. Everything starts there.",
    icon: Target,
  },
  {
    letter: "R",
    word: "Resilience",
    description: "Keep moving when conditions are difficult. Pressure should strengthen the standard, not lower it.",
    icon: Mountain,
  },
  {
    letter: "E",
    word: "Effort",
    description: "Put deliberate work behind the goal. Consistency compounds.",
    icon: Dumbbell,
  },
  {
    letter: "A",
    word: "Accountability",
    description: "Own the outcome. No excuses. No shortcuts.",
    icon: UserCheck,
  },
  {
    letter: "K",
    word: "Knowledge",
    description: "Learn, apply, evaluate, and evolve. Better information should create better action.",
    icon: BookOpen,
  },
];

export const STANDARD_SECTION = {
  heading: "The Standard",
  body:
    "B.R.E.A.K. is not about being perfect.\nIt is about refusing to abandon the standard you set for yourself.\n\n" +
    "Train with purpose.\nOwn your decisions.\nLearn from the result.\nKeep moving forward.",
};

export const CLOSING_STATEMENT = "Keep the promises you make to yourself.";

// Copy for the optional brand card on the More screen — kept here too so all B.R.E.A.K. wording
// lives in one file rather than being scattered across component JSX.
export const MORE_CARD_CONTENT = {
  eyebrow: "B.R.E.A.K.",
  title: "THE STANDARD.",
  body: "More than a brand. A mindset built around the standards we refuse to compromise.",
  cta: "Learn what B.R.E.A.K. means",
};

export const MORE_ROW_CONTENT = {
  label: "B.R.E.A.K. Meaning",
  desc: "What the name stands for, and the standard behind it",
};
