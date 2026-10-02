import type { TimeSeries } from '../simulation/types';

// Derived metrics for one meal, from a glucose series (spec v2, "Derived metrics per meal").

export interface MealMetrics {
  /** Glucose at the meal time, mg/dL. */
  preMeal: number;
  /** Highest glucose after the meal minus preMeal, mg/dL. */
  peakRise: number;
  /** Minutes from the meal to the peak. */
  timeToPeak: number;
  /** Minutes from the meal until glucose is back within RETURN_BAND of preMeal after the peak; null if it never is. */
  timeToBaseline: number | null;
  /** Incremental area under the curve above preMeal, mg/dL·min. */
  iauc: number;
  /** peakRise per gram of net carbohydrate, mg/dL per g. */
  risePerGram: number;
}

/** "Back to baseline" means within this many mg/dL of the pre-meal value, as in spec v1. */
export const RETURN_BAND = 10;

export function mealMetrics(glucose: TimeSeries, mealTime: number, netCarbG: number, until = Infinity): MealMetrics {
  const idx = glucose.times.map((t, i) => [t, i] as const).filter(([t]) => t >= mealTime && t <= until).map(([, i]) => i);
  if (idx.length === 0) throw new Error(`No glucose samples at or after ${mealTime} min`);
  const preMeal = glucose.values[idx[0]!]!;

  let peakIndex = idx[0]!;
  for (const i of idx) if (glucose.values[i]! > glucose.values[peakIndex]!) peakIndex = i;
  const peakRise = glucose.values[peakIndex]! - preMeal;

  let timeToBaseline: number | null = null;
  for (const i of idx) {
    if (i > peakIndex && glucose.values[i]! - preMeal <= RETURN_BAND) {
      timeToBaseline = glucose.times[i]! - mealTime;
      break;
    }
  }

  let iauc = 0;
  for (let k = 1; k < idx.length; k++) {
    const a = idx[k - 1]!;
    const b = idx[k]!;
    const ya = Math.max(0, glucose.values[a]! - preMeal);
    const yb = Math.max(0, glucose.values[b]! - preMeal);
    iauc += ((ya + yb) / 2) * (glucose.times[b]! - glucose.times[a]!);
  }

  return {
    preMeal,
    peakRise,
    timeToPeak: glucose.times[peakIndex]! - mealTime,
    timeToBaseline,
    iauc,
    risePerGram: netCarbG > 0 ? peakRise / netCarbG : NaN,
  };
}
