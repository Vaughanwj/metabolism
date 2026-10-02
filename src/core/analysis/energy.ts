import { citationProblem } from '../model/loader';
import type { Citation } from '../model/types';
import type { MealPayload } from '../simulation/types';

// Energy content of a meal from cited per-gram factors. Display only; no engine uses it.

export interface EnergyFactors {
  id: string;
  kcalPerG: { carbohydrate: number; protein: number; fat: number };
  citation: Citation;
}

export function loadEnergyFactors(raw: unknown): { ok: true; factors: EnergyFactors } | { ok: false; errors: string[] } {
  const r = raw as { id?: unknown; factors?: { nutrient?: unknown; kcalPerG?: unknown }[]; citation?: unknown };
  const errors: string[] = [];
  const kcal: Record<string, number> = {};
  for (const f of Array.isArray(r?.factors) ? r.factors : []) {
    if (typeof f.nutrient === 'string' && typeof f.kcalPerG === 'number') kcal[f.nutrient] = f.kcalPerG;
  }
  for (const n of ['carbohydrate', 'protein', 'fat']) if (!(n in kcal)) errors.push(`missing factor for ${n}`);
  const problem = citationProblem(r?.citation);
  if (problem) errors.push(problem);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    factors: {
      id: String(r.id),
      kcalPerG: { carbohydrate: kcal['carbohydrate']!, protein: kcal['protein']!, fat: kcal['fat']! },
      citation: r.citation as Citation,
    },
  };
}

export function mealEnergyKcal(meal: MealPayload, factors: EnergyFactors): number {
  const k = factors.kcalPerG;
  return meal.carbohydrateG * k.carbohydrate + meal.proteinG * k.protein + meal.fatG * k.fat;
}
