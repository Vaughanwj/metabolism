import type { BodyProfile, Intervention, MealPayload, Scenario } from './types';

// A preset is one base scenario plus exactly one change, so baseline and variant can only
// differ in a single variable.

export interface PresetMeal extends MealPayload {
  time: number;
  description: string;
}

export interface PresetActivity {
  /** Minutes after the meal. */
  startAfterMeal: number;
  durationMin: number;
  intensity: string;
}

export type PresetChange =
  | { variable: 'meal'; meal: PresetMeal }
  | { variable: 'insulinSensitivity'; value: number }
  | { variable: 'activity'; activity: PresetActivity };

export interface Preset {
  id: string;
  title: string;
  question: string;
  expectedObservation: string;
  engineId: string;
  profile: BodyProfile;
  meal: PresetMeal;
  duration: number;
  timeStep: number;
  warmUpMinutes: number;
  change: PresetChange;
}

export interface PresetRuns {
  baseline: Scenario;
  variant: Scenario;
  intervention: Intervention;
}

function scenario(id: string, p: Preset, profile: BodyProfile, meal: PresetMeal, activity?: PresetActivity): Scenario {
  const { time, description: _, ...payload } = meal;
  const events: Scenario['events'] = [{ time, kind: 'meal', payload }];
  if (activity) {
    events.push({ time: time + activity.startAfterMeal, kind: 'activity', payload: { intensity: activity.intensity, durationMin: activity.durationMin } });
  }
  return {
    id,
    profile,
    events,
    duration: p.duration,
    timeStep: p.timeStep,
    engineId: p.engineId,
    warmUpMinutes: p.warmUpMinutes,
  };
}

export function presetRuns(p: Preset): PresetRuns {
  const baseline = scenario(`${p.id}:baseline`, p, p.profile, p.meal);
  switch (p.change.variable) {
    case 'meal':
      return {
        baseline,
        variant: scenario(`${p.id}:variant`, p, p.profile, p.change.meal),
        intervention: { variable: 'Meal', before: p.meal.description, after: p.change.meal.description },
      };
    case 'insulinSensitivity': {
      const pct = (x: number) => `${Math.round(x * 100)}% of normal`;
      return {
        baseline,
        variant: scenario(`${p.id}:variant`, p, { ...p.profile, insulinSensitivity: p.change.value }, p.meal),
        intervention: { variable: 'Insulin sensitivity', before: pct(p.profile.insulinSensitivity), after: pct(p.change.value) },
      };
    }
    case 'activity': {
      const a = p.change.activity;
      return {
        baseline,
        variant: scenario(`${p.id}:variant`, p, p.profile, p.meal, a),
        intervention: {
          variable: 'Activity after the meal',
          before: 'rest',
          after: `${a.durationMin} min of ${a.intensity} activity, starting ${a.startAfterMeal} min after the meal`,
        },
      };
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkMeal(m: unknown, path: string, errors: string[]): void {
  if (!isRecord(m)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of ['time', 'carbohydrateG', 'proteinG', 'fatG', 'fiberG']) {
    if (typeof m[key] !== 'number' || (m[key] as number) < 0) errors.push(`${path}.${key} must be a number >= 0`);
  }
  if (typeof m['description'] !== 'string' || m['description'] === '') errors.push(`${path}.description must be a non-empty string`);
}

/** Checks a preset's shape. Whether its values are in range is checkScenario's job. */
export function loadPreset(raw: unknown): { ok: true; preset: Preset } | { ok: false; errors: string[] } {
  if (!isRecord(raw)) return { ok: false, errors: ['preset must be an object'] };
  const errors: string[] = [];
  for (const key of ['id', 'title', 'question', 'expectedObservation', 'engineId']) {
    if (typeof raw[key] !== 'string' || raw[key] === '') errors.push(`${key} must be a non-empty string`);
  }
  for (const key of ['duration', 'timeStep', 'warmUpMinutes']) {
    if (typeof raw[key] !== 'number' || (raw[key] as number) < 0) errors.push(`${key} must be a number >= 0`);
  }
  const profile = raw['profile'];
  if (!isRecord(profile) || typeof profile['insulinSensitivity'] !== 'number' || typeof profile['weightKg'] !== 'number') {
    errors.push('profile must include weightKg and insulinSensitivity');
  }
  checkMeal(raw['meal'], 'meal', errors);
  const change = raw['change'];
  if (!isRecord(change)) errors.push('change must be an object');
  else if (change['variable'] === 'meal') checkMeal(change['meal'], 'change.meal', errors);
  else if (change['variable'] === 'insulinSensitivity') {
    if (typeof change['value'] !== 'number') errors.push('change.value must be a number');
  } else if (change['variable'] === 'activity') {
    const a = change['activity'];
    if (!isRecord(a) || typeof a['startAfterMeal'] !== 'number' || typeof a['durationMin'] !== 'number' || typeof a['intensity'] !== 'string') {
      errors.push('change.activity needs startAfterMeal, durationMin and intensity');
    }
  } else errors.push('change.variable must be "meal", "insulinSensitivity" or "activity"');

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, preset: raw as unknown as Preset };
}
