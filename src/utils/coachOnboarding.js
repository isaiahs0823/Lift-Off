// Tracks whether the user has ever gone through the "Select Your Coach" specialty-selection
// step — separate from athleteProfile.coachSpecialty (which always carries a value, defaulting
// to "bodybuilding", even for someone who's never seen the picker). specialtySelected is the
// sole source of truth for whether the picker has been shown: it is never inferred from other
// existing data (Athlete Profile, Coach history, Coach memories), because none of that data
// implies a specialty was ever explicitly chosen — it all predates the picker existing at all.
// A user with years of Coach history still sees this screen exactly once, same as someone
// brand new; only their Athlete Profile completeness (handled separately, elsewhere) decides
// whether they're also asked the athlete questionnaire afterward.

export function defaultCoachOnboarding() {
  return {
    specialtySelected: false,
    specialty: null,
    confirmedAt: null,
  };
}

export function resolveCoachOnboarding(state) {
  return { ...defaultCoachOnboarding(), ...(state.coachOnboarding || {}) };
}
