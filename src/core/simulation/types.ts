import type { Citation } from '../model/types';

// Simulation: what happens when the machine is run. Types only for milestone 1;
// engines arrive in milestones 2 and 5.

export type EngineScale = 'meal' | 'energy';

/** A cited model parameter. Unverified parameters are not loaded. */
export interface Parameter {
  id: string;
  value: number;
  unit: string;
  description: string;
  citation: Citation;
}

/** A named, cited set of parameters for one engine, e.g. "Dalla Man 2007, normal subject". */
export interface ParameterSet {
  id: string;
  engineId: string;
  name: string;
  parameters: Parameter[];
}

/** Bounds an input to the range its source model was validated for. */
export interface ValidatedRange {
  min: number;
  max: number;
  unit: string;
  citation: Citation;
}

export type Sex = 'female' | 'male';

export interface BodyProfile {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number;
  /** Relative to the model's normal subject: 1 = normal, below 1 = resistant. */
  insulinSensitivity: number;
  activityLevel: number;
}

export interface MealPayload {
  carbohydrateG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
}

export interface ActivityPayload {
  intensity: string;
  durationMin: number;
}

export type ScenarioEvent =
  | { time: number; kind: 'meal'; payload: MealPayload }
  | { time: number; kind: 'activity'; payload: ActivityPayload }
  | { time: number; kind: 'fast'; payload: { durationMin: number } };

export interface Scenario {
  id: string;
  profile: BodyProfile;
  events: ScenarioEvent[];
  /** Run length in the engine's time unit (minutes for meal scale, days for energy scale). */
  duration: number;
  timeStep: number;
  engineId: string;
  /**
   * Minutes to run with no events before time zero, so the run starts from the model's own
   * steady state for this profile rather than from the source's initial values.
   */
  warmUpMinutes?: number;
}

/** The one variable changed between baseline and variant. */
export interface Intervention {
  variable: string;
  before: unknown;
  after: unknown;
}

export interface TimeSeries {
  variable: string;
  unit: string;
  times: number[];
  values: number[];
}

export interface RunResult {
  scenarioId: string;
  engineId: string;
  engineVersion: string;
  parameterSetId: string;
  series: TimeSeries[];
  flowTotals: Record<string, number>;
  citations: Citation[];
  /** What the model leaves out or simplifies; shown beside every chart. */
  limitations: string[];
}

export interface Comparison {
  intervention: Intervention;
  baseline: RunResult;
  variant: RunResult;
  /** Difference in each flow total, variant minus baseline. */
  flowDeltas: Record<string, number>;
  /** Flows that account for most of the difference, largest first. */
  explainingFlows: string[];
}

export interface LessonStep {
  baseline: Scenario;
  variant: Scenario;
  intervention: Intervention;
  question: string;
  expectedObservation: string;
}

export interface Lesson {
  id: string;
  title: string;
  steps: LessonStep[];
}

/** A deterministic simulation engine implementing one published model. */
export interface SimulationEngine {
  id: string;
  version: string;
  scale: EngineScale;
  /** Reference to the model's source paper. */
  source: Citation;
  run(scenario: Scenario, parameters: ParameterSet): RunResult;
}
