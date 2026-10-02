import type { Citation } from '../../model/types';
import { rk4Step } from '../integrate';
import type { ParameterSet, RunResult, Scenario, SimulationEngine, TimeSeries } from '../types';

// Meal simulation model of the glucose-insulin system, normal subject.
// Dalla Man C, Rizza RA, Cobelli C. IEEE Trans Biomed Eng 2007;54(10):1740-9.
//
// Implemented from the curated SBML in BioModels (BIOMD0000000379), which is the project's
// source of record while the paper itself is unavailable. Where the SBML is known or suspected
// to differ from the paper, this engine follows the SBML and says so in RunResult.limitations:
// - renal excretion is fixed at zero;
// - insulin secretion has no piecewise conditions on falling or below-basal glucose;
// - insulin-dependent uptake is scaled by (1 - part), a factor that appears only in the SBML.
//
// Optional exercise extension (engine 0.4): during activity, insulin-independent glucose disposal
// rises by the healthy-subject effect size reported by Romeres et al. 2021 (their IIRd: all
// insulin-independent disposal, here U_ii plus the V_m0 uptake term, with the extra taken up by
// working muscle), and the insulin-dependent V_mX term rises by their insulin-dependent effect size.
// Both apply immediately: the paper's delayed insulin-dependent effect is not reproduced because its
// rate constant is unpublished. The activity signal is a square wave smoothed by a first-order filter,
// as in that paper. This combination is the project's own, not a published model, and runs with
// activity say so in their limitations.
//
// Time is in minutes. Glucose masses are mg/kg, insulin masses pmol/kg, the stomach and gut
// hold mg, G is mg/dL and I is pmol/L.

export const DALLA_MAN_2007_SOURCE: Citation = {
  source: 'Dalla Man C, Rizza RA, Cobelli C. Meal simulation model of the glucose-insulin system. IEEE Trans Biomed Eng. 2007;54(10):1740-9',
  locator: 'Curated SBML, BioModels BIOMD0000000379',
  url: 'https://biomodels.org/BIOMD0000000379',
  verifiedBy: '',
  verifiedOn: '',
};

const ENGINE_ID = 'dalla-man-2007';
const ENGINE_VERSION = '0.4.0';

export const LIMITATIONS = [
  'Glucose appearance is driven by carbohydrate only; protein and fat do not enter this model, and it does not capture how they slow digestion.',
  'Renal glucose excretion is fixed at zero, as in the curated SBML.',
  'Insulin secretion omits the paper\'s conditions for falling or below-basal glucose, as in the curated SBML.',
  'Parameters describe the average normal subject of the source study, not any individual.',
];

export const EXERCISE_LIMITATIONS = [
  "Exercise effects combine this meal model with effect sizes from a separate study (Romeres et al. 2021, healthy adults, 65% VO2max, fasting clamp). The combination is this project's own, not a published model.",
  "During exercise the liver's extra glucose release is not modeled, and the delayed part of exercise's effect on insulin action is applied immediately.",
];

/** Parameters needed only when a scenario includes activity. */
const EXERCISE = ['ex_iid_increase', 'ex_id_increase', 'ex_tau'] as const;
type ExerciseParams = { iid: number; id: number; tau: number };

const REQUIRED = [
  'V_G', 'k_1', 'k_2', 'G_b', 'V_I', 'm_1', 'm_2', 'm_4', 'm_5', 'm_6', 'I_b', 'S_b',
  'k_max', 'k_min', 'k_abs', 'k_gri', 'f', 'b', 'd', 'BW',
  'k_p1', 'k_p2', 'k_p3', 'k_p4', 'k_i', 'U_ii', 'V_m0', 'V_mX', 'K_m0', 'p_2U', 'part',
  'K', 'alpha', 'beta', 'gamma',
  'G_p0', 'G_t0', 'I_l0', 'I_p0', 'I_10', 'I_d0', 'X0', 'I_po0', 'Y0',
] as const;

type ParamId = (typeof REQUIRED)[number];
type Params = Record<ParamId, number>;

// State vector layout.
const G_P = 0, G_T = 1, I_L = 2, I_P = 3, Q_STO1 = 4, Q_STO2 = 5, Q_GUT = 6, I_1 = 7, I_D = 8, X = 9, I_PO = 10, Y = 11, EX = 12;

function readParams(set: ParameterSet): Params {
  const byId = new Map(set.parameters.map((p) => [p.id, p.value]));
  const missing = REQUIRED.filter((id) => !byId.has(id));
  if (missing.length > 0) throw new Error(`Parameter set ${set.id} is missing: ${missing.join(', ')}`);
  return Object.fromEntries(REQUIRED.map((id) => [id, byId.get(id)!])) as Params;
}

function readExercise(set: ParameterSet): ExerciseParams {
  const byId = new Map(set.parameters.map((p) => [p.id, p.value]));
  const missing = EXERCISE.filter((id) => !byId.has(id));
  if (missing.length > 0) throw new Error(`Parameter set ${set.id} has no exercise parameters (${missing.join(', ')}), so activity cannot be simulated`);
  return { iid: byId.get('ex_iid_increase')!, id: byId.get('ex_id_increase')!, tau: byId.get('ex_tau')! };
}

/** Fluxes and outputs that are algebraic functions of the state. */
function fluxes(p: Params, x: readonly number[], lastMealMg: number, ex: ExerciseParams | null) {
  const G = x[G_P]! / p.V_G;
  const I = x[I_P]! / p.V_I;
  const Qsto = x[Q_STO1]! + x[Q_STO2]!;

  // Gastric emptying slows as the stomach empties, then speeds up again (paper eq. for k_empt).
  // With no meal yet the stomach is empty and the rate is irrelevant; use k_max.
  let kEmpt = p.k_max;
  if (lastMealMg > 0) {
    const aa = 5 / (2 * (1 - p.b) * lastMealMg);
    const cc = 5 / (2 * p.d * lastMealMg);
    kEmpt = p.k_min + ((p.k_max - p.k_min) / 2) *
      (Math.tanh(aa * (Qsto - p.b * lastMealMg)) - Math.tanh(cc * (Qsto - p.d * lastMealMg)) + 2);
  }

  const Ra = (p.f * p.k_abs * x[Q_GUT]!) / p.BW;
  const EGP = p.k_p1 - p.k_p2 * x[G_P]! - p.k_p3 * x[I_D]! - p.k_p4 * x[I_PO]!;
  const e = ex ? x[EX]! : 0;
  const Vm = (1 - p.part) * (p.V_m0 * (1 + (ex?.iid ?? 0) * e) + p.V_mX * (1 + (ex?.id ?? 0) * e) * x[X]!);
  // Brain and red-cell use (U_ii) does not rise with exercise; the matching extra disposal goes to muscle.
  const Uid = (Vm * x[G_T]!) / (p.K_m0 + x[G_T]!) + (ex?.iid ?? 0) * e * p.U_ii;
  const E = 0;
  const dGp = EGP + Ra - E - p.U_ii - p.k_1 * x[G_P]! + p.k_2 * x[G_T]!;
  const Spo = x[Y]! + (p.K * dGp) / p.V_G + p.S_b;
  const S = p.gamma * x[I_PO]!;
  const HE = -p.m_5 * S + p.m_6;
  const m3 = (HE * p.m_1) / (1 - HE);
  return { G, I, kEmpt, Ra, EGP, Uid, E, dGp, Spo, S, m3 };
}

function derivative(p: Params, lastMealMg: number, ex: ExerciseParams | null, active: (t: number) => number) {
  return (t: number, x: readonly number[]): number[] => {
    const f = fluxes(p, x, lastMealMg, ex);
    const dx = new Array<number>(13);
    dx[G_P] = f.dGp;
    dx[G_T] = -f.Uid + p.k_1 * x[G_P]! - p.k_2 * x[G_T]!;
    dx[I_L] = -(p.m_1 + f.m3) * x[I_L]! + p.m_2 * x[I_P]! + f.S;
    dx[I_P] = -(p.m_2 + p.m_4) * x[I_P]! + p.m_1 * x[I_L]!;
    dx[Q_STO1] = -p.k_gri * x[Q_STO1]!;
    dx[Q_STO2] = -f.kEmpt * x[Q_STO2]! + p.k_gri * x[Q_STO1]!;
    dx[Q_GUT] = -p.k_abs * x[Q_GUT]! + f.kEmpt * x[Q_STO2]!;
    dx[I_1] = -p.k_i * (x[I_1]! - f.I);
    dx[I_D] = -p.k_i * (x[I_D]! - x[I_1]!);
    dx[X] = -p.p_2U * x[X]! + p.p_2U * (f.I - p.I_b);
    dx[I_PO] = -p.gamma * x[I_PO]! + f.Spo;
    dx[Y] = -p.alpha * (x[Y]! - p.beta * (f.G - p.G_b));
    dx[EX] = ex ? (active(t) - x[EX]!) / ex.tau : 0;
    return dx;
  };
}

const OUTPUTS = [
  ['G', 'mg/dL'],
  ['I', 'pmol/L'],
  ['Ra', 'mg/kg/min'],
  ['EGP', 'mg/kg/min'],
  ['U', 'mg/kg/min'],
  ['U_ii', 'mg/kg/min'],
  ['U_id', 'mg/kg/min'],
  ['S', 'pmol/kg/min'],
  ['Q_sto', 'mg'],
  ['Q_gut', 'mg'],
  ['activity', 'fraction'],
] as const;

function isMultiple(value: number, step: number): boolean {
  const n = Math.round(value / step);
  return Math.abs(n * step - value) < 1e-9 * Math.max(1, Math.abs(value));
}

export const dallaMan2007: SimulationEngine = {
  id: ENGINE_ID,
  version: ENGINE_VERSION,
  scale: 'meal',
  source: DALLA_MAN_2007_SOURCE,

  run(scenario: Scenario, parameters: ParameterSet): RunResult {
    const p = readParams(parameters);
    const h = scenario.timeStep;
    if (!(h > 0) || !isMultiple(1, h)) throw new Error('timeStep must divide one minute evenly');
    if (!(scenario.duration > 0) || !Number.isInteger(scenario.duration)) throw new Error('duration must be a whole number of minutes');

    const meals = new Map<number, number>();
    const activities: [number, number][] = [];
    for (const event of scenario.events) {
      if (event.time < 0 || event.time > scenario.duration || !isMultiple(event.time, h)) {
        throw new Error(`The ${event.kind} at ${event.time} min must fall on a time step within the run`);
      }
      if (event.kind === 'meal') {
        const step = Math.round(event.time / h);
        meals.set(step, (meals.get(step) ?? 0) + event.payload.carbohydrateG * 1000);
      } else if (event.kind === 'activity') {
        if (!(event.payload.durationMin > 0) || !isMultiple(event.payload.durationMin, h)) {
          throw new Error('Activity duration must be a positive whole number of time steps');
        }
        activities.push([event.time, event.time + event.payload.durationMin]);
      } else {
        throw new Error(`This engine does not model "${event.kind}" events`);
      }
    }
    const ex = activities.length > 0 ? readExercise(parameters) : null;
    // Activity windows are half-open, [start, end), and start and end fall on step boundaries.
    const active = (t: number) => (activities.some(([a, b]) => t >= a - 1e-9 && t < b - 1e-9) ? 1 : 0);

    let x = [p.G_p0, p.G_t0, p.I_l0, p.I_p0, 0, 0, 0, p.I_10, p.I_d0, p.X0, p.I_po0, p.Y0, 0];
    let lastMealMg = 0;
    const stepsPerMinute = Math.round(1 / h);

    // Optional warm-up with no meals, so the run starts from this profile's steady state.
    const warmUp = scenario.warmUpMinutes ?? 0;
    if (warmUp < 0 || !Number.isInteger(warmUp)) throw new Error('warmUpMinutes must be a whole number of minutes');
    const fasting = derivative(p, 0, null, () => 0);
    for (let step = 0; step < warmUp * stepsPerMinute; step++) x = rk4Step(fasting, step * h, x, h);
    const totalSteps = scenario.duration * stepsPerMinute;
    const series = OUTPUTS.map(([variable, unit]): TimeSeries => ({ variable, unit, times: [], values: [] }));
    const totals = { Ra: 0, EGP: 0, U_ii: 0, U_id: 0, S: 0 };

    const record = (t: number) => {
      const f = fluxes(p, x, lastMealMg, ex);
      const values = [f.G, f.I, f.Ra, f.EGP, p.U_ii + f.Uid, p.U_ii, f.Uid, f.S, x[Q_STO1]! + x[Q_STO2]!, x[Q_GUT]!, x[EX]!];
      series.forEach((s, i) => {
        s.times.push(t);
        s.values.push(values[i]!);
      });
    };

    for (let step = 0; step <= totalSteps; step++) {
      const meal = meals.get(step);
      if (meal !== undefined) {
        x[Q_STO1] = x[Q_STO1]! + meal;
        lastMealMg = meal;
      }
      if (step % stepsPerMinute === 0) record(step / stepsPerMinute);
      if (step === totalSteps) break;

      // Flow totals by the trapezoidal rule over each step.
      const before = fluxes(p, x, lastMealMg, ex);
      // The activity switch is constant within a step, evaluated at the step's start.
      const on = active(step * h);
      x = rk4Step(derivative(p, lastMealMg, ex, () => on), step * h, x, h);
      const after = fluxes(p, x, lastMealMg, ex);
      totals.Ra += (h / 2) * (before.Ra + after.Ra);
      totals.EGP += (h / 2) * (before.EGP + after.EGP);
      totals.U_ii += h * p.U_ii;
      totals.U_id += (h / 2) * (before.Uid + after.Uid);
      totals.S += (h / 2) * (before.S + after.S);
    }

    return {
      scenarioId: scenario.id,
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      parameterSetId: parameters.id,
      series,
      flowTotals: totals,
      citations: [DALLA_MAN_2007_SOURCE, ...parameters.parameters.map((q) => q.citation)],
      limitations: ex ? [...LIMITATIONS, ...EXERCISE_LIMITATIONS] : LIMITATIONS,
    };
  },
};
