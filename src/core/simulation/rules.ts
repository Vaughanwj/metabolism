import { citationProblem } from '../model/loader';
import type { Citation } from '../model/types';
import type { BodyProfile, ParameterSet, Scenario } from './types';

// What an engine may be asked to do. Each input has a range taken from its source, with a
// checked citation; scenarios outside a range are refused, never extrapolated.

export type InputId = 'carbohydrateG' | 'insulinSensitivity' | 'activityStartMin' | 'activityDurationMin';

export interface InputRule {
  id: InputId;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** For profile multipliers: the parameters this input scales. */
  scales?: string[];
  citation: Citation;
}

export interface ScenarioRules {
  engineId: string;
  inputs: InputRule[];
}

export type RulesResult = { ok: true; rules: ScenarioRules } | { ok: false; errors: string[] };

const INPUT_IDS: readonly InputId[] = ['carbohydrateG', 'insulinSensitivity', 'activityStartMin', 'activityDurationMin'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadScenarioRules(raw: unknown): RulesResult {
  if (!isRecord(raw)) return { ok: false, errors: ['rules must be an object'] };
  const errors: string[] = [];
  if (typeof raw['engineId'] !== 'string' || raw['engineId'] === '') errors.push('engineId must be a non-empty string');
  if (!Array.isArray(raw['inputs'])) return { ok: false, errors: [...errors, 'inputs must be an array'] };

  const inputs: InputRule[] = [];
  raw['inputs'].forEach((e: unknown, i: number) => {
    const path = `inputs[${i}]`;
    if (!isRecord(e)) {
      errors.push(`${path} must be an object`);
      return;
    }
    const id = e['id'] as InputId;
    const label = typeof e['id'] === 'string' ? e['id'] : path;
    if (!INPUT_IDS.includes(id)) errors.push(`${path}.id must be one of ${INPUT_IDS.join(', ')}`);
    for (const key of ['label', 'unit']) {
      if (typeof e[key] !== 'string' || e[key] === '') errors.push(`${label}: ${key} must be a non-empty string`);
    }
    const { min, max, scales } = e;
    if (typeof min !== 'number' || typeof max !== 'number' || !(min <= max)) errors.push(`${label}: min and max must be numbers with min <= max`);
    if (scales !== undefined && (!Array.isArray(scales) || !scales.every((s) => typeof s === 'string'))) {
      errors.push(`${label}: scales must be an array of parameter ids`);
    }
    const problem = citationProblem(e['citation']);
    if (problem) errors.push(`${label}: ${problem}`);
    inputs.push(e as unknown as InputRule);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rules: { engineId: raw['engineId'] as string, inputs } };
}

function rule(rules: ScenarioRules, id: InputId): InputRule | undefined {
  return rules.inputs.find((r) => r.id === id);
}

function outside(r: InputRule, value: number, what: string): string | undefined {
  if (value >= r.min && value <= r.max) return undefined;
  return `${what} is ${value} ${r.unit}, outside the ${r.min}–${r.max} ${r.unit} range covered by this model's sources (${r.citation.source}).`;
}

/** Returns the reasons a scenario must be refused; empty if it may run. */
export function checkScenario(scenario: Scenario, rules: ScenarioRules): string[] {
  const reasons: string[] = [];
  if (scenario.engineId !== rules.engineId) reasons.push(`Scenario is for ${scenario.engineId}, rules are for ${rules.engineId}.`);
  const carbs = rule(rules, 'carbohydrateG');
  for (const e of scenario.events) {
    if (e.kind === 'meal' && carbs) {
      const r = outside(carbs, e.payload.carbohydrateG, `The meal at ${e.time} min has carbohydrate that`);
      if (r) reasons.push(r);
    }
  }
  const firstMeal = Math.min(...scenario.events.filter((e) => e.kind === 'meal').map((e) => e.time));
  const start = rule(rules, 'activityStartMin');
  const length = rule(rules, 'activityDurationMin');
  for (const e of scenario.events) {
    if (e.kind !== 'activity') continue;
    if (!start || !length || !Number.isFinite(firstMeal)) {
      reasons.push('This engine has no sourced range for activity in this scenario.');
      continue;
    }
    const r1 = outside(start, e.time - firstMeal, 'Activity starting after the meal');
    const r2 = outside(length, e.payload.durationMin, 'Activity duration');
    for (const r of [r1, r2]) if (r) reasons.push(r);
  }

  const sensitivity = rule(rules, 'insulinSensitivity');
  if (sensitivity) {
    const r = outside(sensitivity, scenario.profile.insulinSensitivity, 'Insulin sensitivity');
    if (r) reasons.push(r);
  } else if (scenario.profile.insulinSensitivity !== 1) {
    reasons.push('This engine has no sourced way to change insulin sensitivity.');
  }
  return reasons;
}

/** Applies the profile's multipliers to a parameter set, per the cited rules. */
export function applyProfile(set: ParameterSet, profile: BodyProfile, rules: ScenarioRules): ParameterSet {
  const sensitivity = rule(rules, 'insulinSensitivity');
  const factor = profile.insulinSensitivity;
  if (!sensitivity?.scales || factor === 1) return set;
  const scaled = new Set(sensitivity.scales);
  const missing = sensitivity.scales.filter((id) => !set.parameters.some((p) => p.id === id));
  if (missing.length > 0) throw new Error(`Parameter set ${set.id} has no ${missing.join(', ')} to scale`);
  return {
    ...set,
    id: `${set.id}@insulin-sensitivity-${factor}`,
    name: `${set.name}, insulin sensitivity ${Math.round(factor * 100)}% of normal`,
    parameters: set.parameters.map((p) =>
      scaled.has(p.id) ? { ...p, value: p.value * factor, description: `${p.description} (× ${factor}, per ${sensitivity.citation.source})` } : p,
    ),
  };
}
