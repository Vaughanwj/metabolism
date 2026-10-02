import './ui/styles.css';
import {
  loadBinding,
  loadEnergyFactors,
  loadParameterSet,
  loadPreset,
  loadReferenceModel,
  loadScenarioRules,
  type Preset,
  type ScenarioRules,
} from './core';
import { bundledReferenceModel } from './adapters/bundled-reference-model';
import { mountApp } from './ui/app';
import binding from '../data/bindings/dalla-man-2007.json';
import normalSubject from '../data/parameters/dalla-man-2007-normal.json';
import rulesData from '../data/rules/dalla-man-2007.json';
import energyData from '../data/reference/energy-factors.json';

// Composition root: load and check the data, then mount the comparison page.

const presetFiles = import.meta.glob<{ default: unknown }>('../data/presets/*.json', { eager: true });
const PRESET_ORDER = ['same-calories-different-fuel', 'the-resistant-machine'];

const root = document.querySelector<HTMLElement>('#app')!;

function fail(title: string, errors: string[]): never {
  root.replaceChildren(Object.assign(document.createElement('pre'), { className: 'load-error', textContent: `${title}\n${errors.join('\n')}` }));
  throw new Error(title);
}

// Development only: look at the page before every citation is signed off, with a loud warning.
// Production builds always refuse unverified values.
const previewUnverified = import.meta.env.DEV && new URLSearchParams(location.search).has('preview-unverified');
const unverified: string[] = [];

const modelResult = loadReferenceModel(await bundledReferenceModel.load());
if (!modelResult.ok) fail('The reference model failed to load.', modelResult.errors);
const model = modelResult.model;

const bindingResult = loadBinding(binding, model);
if (!bindingResult.ok) fail('The engine binding failed to load.', bindingResult.errors);

const params = loadParameterSet(normalSubject);
if (!params.ok) fail('The parameter set was refused.', params.errors);

let rules: ScenarioRules;
const rulesResult = loadScenarioRules(rulesData);
if (rulesResult.ok) rules = rulesResult.rules;
else if (previewUnverified) {
  rules = rulesData as unknown as ScenarioRules;
  unverified.push(...rulesResult.errors.map((e) => `Input ranges: ${e}`));
} else fail('The input ranges were refused. They need a checked citation before the simulator can run.', rulesResult.errors);

const energyResult = loadEnergyFactors(energyData);
if (!energyResult.ok) unverified.push(...energyResult.errors.map((e) => `Energy factors: ${e}`));

const presets: Preset[] = [];
for (const [path, mod] of Object.entries(presetFiles)) {
  const p = loadPreset(mod.default);
  if (!p.ok) fail(`Preset ${path} failed to load.`, p.errors);
  presets.push(p.preset);
}
presets.sort((a, b) => PRESET_ORDER.indexOf(a.id) - PRESET_ORDER.indexOf(b.id));

if (previewUnverified && unverified.length > 0) {
  const banner = Object.assign(document.createElement('div'), { className: 'preview-banner', role: 'alert' });
  banner.append(Object.assign(document.createElement('strong'), { textContent: 'Development preview with unchecked values. ' }), unverified.join(' · '));
  document.body.prepend(banner);
}

mountApp(root, {
  model,
  binding: bindingResult.binding,
  params: params.set,
  rules,
  presets,
  energy: energyResult.ok ? energyResult.factors : null,
  modelLabel: 'Dalla Man, Rizza & Cobelli 2007 meal model (curated SBML, BioModels BIOMD0000000379)',
});
