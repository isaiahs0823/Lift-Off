// Tracks whether the user has ever gone through the "Select Your Coach" specialty-selection
// step — separate from athleteProfile.coachSpecialty (which always carries a value, defaulting
// to "bodybuilding", even for someone who's never seen the picker). This is what lets a
// brand-new user be shown the picker exactly once, while an existing user with real Coach data
// is migrated straight past it instead of being forced through it again.

export function defaultCoachOnboarding() {
  return {
    specialtySelected: false,
    specialty: null,
    confirmedAt: null,
    migrationNoticeShown: false,
  };
}

export function resolveCoachOnboarding(state) {
  return { ...defaultCoachOnboarding(), ...(state.coachOnboarding || {}) };
}

// A user counts as "existing" for migration purposes if there's any real Coach-relevant data
// on file already — profile, history, or memory — even though coachOnboarding itself is new
// and therefore unset for every user created before this feature shipped.
export function isExistingCoachUser(state) {
  return !!(
    state.athleteProfile?.onboardedAt ||
    (state.coachHistory && state.coachHistory.length > 0) ||
    (state.coachMemories && state.coachMemories.length > 0)
  );
}
