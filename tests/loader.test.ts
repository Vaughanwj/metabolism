import { describe, expect, it } from 'vitest';
import { citationProblem, loadReferenceModel } from '../src/core';
import metabolism from '../data/reference-model/metabolism.json';

const verified = { source: 'Example source 2020', locator: 'Table 1', verifiedBy: 'A Reviewer', verifiedOn: '2026-10-01' };

function minimalModel(extra: Record<string, unknown> = {}) {
  return {
    components: [
      { id: 'blood', name: 'Blood', kind: 'compartment', description: 'Carries fuel.' },
      { id: 'muscle', name: 'Muscle', kind: 'tissue', description: 'Burns fuel.' },
      { id: 'pancreas', name: 'Pancreas', kind: 'organ', description: 'Makes insulin.' },
    ],
    flows: [{ id: 'uptake', from: 'blood', to: 'muscle', substance: 'glucose' }],
    controls: [{ id: 'insulin', name: 'Insulin', producedBy: 'pancreas', actsOn: ['uptake'], effect: 'Moves glucose into muscle.' }],
    ...extra,
  };
}

describe('citationProblem', () => {
  it('accepts a verified citation', () => {
    expect(citationProblem(verified)).toBeUndefined();
  });

  it.each([
    [undefined, 'no citation'],
    [{ ...verified, source: '' }, 'citation has no source'],
    [{ source: 'X', verifiedOn: '2026-10-01' }, 'citation not verified by a named person'],
    [{ source: 'X', verifiedBy: 'A Reviewer' }, 'citation has no valid verifiedOn date (YYYY-MM-DD)'],
    [{ ...verified, verifiedOn: '2026-13-45' }, 'citation has no valid verifiedOn date (YYYY-MM-DD)'],
  ])('rejects %j', (citation, reason) => {
    expect(citationProblem(citation)).toBe(reason);
  });
});

describe('loadReferenceModel', () => {
  it('loads a well-formed model and derives controlledBy from controls', () => {
    const result = loadReferenceModel(minimalModel());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.flows[0]?.controlledBy).toEqual(['insulin']);
    expect(result.rejected).toEqual([]);
  });

  it('drops unsourced or unverified facts and loads the rest', () => {
    const result = loadReferenceModel(
      minimalModel({
        needs: [
          { id: 'oxygen', target: { componentId: 'muscle' }, substance: 'oxygen', role: 'burning fuel', citation: verified },
          { id: 'thiamine', target: { componentId: 'muscle' }, substance: 'thiamine', role: 'cofactor' },
        ],
        referenceRanges: [
          { id: 'fasting-glucose', metric: 'glucose', unit: 'mg/dL', low: 70, high: 99, population: 'adults', context: 'fasting', citation: { source: 'Unchecked' } },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.needs.map((n) => n.id)).toEqual(['oxygen']);
    expect(result.model.referenceRanges).toEqual([]);
    expect(result.rejected).toEqual([
      { section: 'needs', id: 'thiamine', reason: 'no citation' },
      { section: 'referenceRanges', id: 'fasting-glucose', reason: 'citation not verified by a named person' },
    ]);
  });

  it('reports dangling references', () => {
    const model = minimalModel();
    model.flows.push({ id: 'burn', from: 'muscle', to: 'exhaust', substance: 'CO2' });
    model.controls[0]!.actsOn.push('missing-flow');
    const result = loadReferenceModel(model);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      'flows[1].to: unknown component "exhaust"',
      'controls[0].actsOn[1]: unknown flow "missing-flow"',
    ]);
  });

  it('reports duplicate ids and bad kinds', () => {
    const model = minimalModel();
    model.components.push({ id: 'blood', name: 'Blood again', kind: 'organelle', description: 'Duplicate.' });
    const result = loadReferenceModel(model);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('components: duplicate id "blood"');
    expect(result.errors).toContain('components[3].kind: must be one of organ, tissue, compartment, placeholder');
  });

  it('refuses controlledBy stated on a flow', () => {
    const model = minimalModel();
    (model.flows[0] as Record<string, unknown>)['controlledBy'] = ['insulin'];
    const result = loadReferenceModel(model);
    expect(result.ok).toBe(false);
  });

  it('reports a reference range whose low exceeds its high', () => {
    const result = loadReferenceModel(
      minimalModel({
        referenceRanges: [{ id: 'r', metric: 'm', unit: 'u', low: 10, high: 5, population: 'p', context: 'c', citation: verified }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects input that is not an object', () => {
    expect(loadReferenceModel(null)).toEqual({ ok: false, errors: ['reference model must be an object'] });
  });
});

describe('bundled metabolism reference model', () => {
  const result = loadReferenceModel(metabolism);

  it('loads without errors', () => {
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('contains every component named in spec v2', () => {
    if (!result.ok) throw new Error('model failed to load');
    const ids = result.model.components.map((c) => c.id);
    for (const id of ['intake', 'gut', 'lymph', 'portal-vein', 'liver', 'blood', 'pancreas', 'muscle', 'adipose', 'brain', 'exhaust', 'kidneys', 'respiratory-loop']) {
      expect(ids).toContain(id);
    }
  });

  it('routes fat through the lymph, bypassing the liver at first', () => {
    if (!result.ok) throw new Error('model failed to load');
    const fatFlows = result.model.flows.filter((f) => f.substance === 'fat');
    expect(fatFlows.find((f) => f.from === 'gut')?.to).toBe('lymph');
    expect(fatFlows.some((f) => f.to === 'liver')).toBe(false);
  });
});
