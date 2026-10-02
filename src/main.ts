import './ui/styles.css';
import { dallaMan2007, loadBinding, loadParameterSet, loadReferenceModel, type Scenario } from './core';
import { bundledReferenceModel } from './adapters/bundled-reference-model';
import { mountApp } from './ui/app';
import binding from '../data/bindings/dalla-man-2007.json';
import normalSubject from '../data/parameters/dalla-man-2007-normal.json';

// Composition root: load and check the data, run the default scenario, mount the view.

const root = document.querySelector<HTMLElement>('#app')!;

function fail(title: string, errors: string[]): never {
  const pre = document.createElement('pre');
  pre.className = 'load-error';
  pre.textContent = `${title}\n${errors.join('\n')}`;
  root.replaceChildren(pre);
  throw new Error(title);
}

const modelResult = loadReferenceModel(await bundledReferenceModel.load());
if (!modelResult.ok) fail('The reference model failed to load.', modelResult.errors);
const model = modelResult.model;

const bindingResult = loadBinding(binding, model);
if (!bindingResult.ok) fail('The engine binding failed to load.', bindingResult.errors);

const params = loadParameterSet(normalSubject);
if (!params.ok) fail('The parameter set was refused.', params.errors);

const scenario: Scenario = {
  id: 'default-breakfast',
  profile: { age: 40, sex: 'female', heightCm: 170, weightKg: 78, insulinSensitivity: 1, activityLevel: 1.5 },
  events: [{ time: 0, kind: 'meal', payload: { carbohydrateG: 78, proteinG: 0, fatG: 0, fiberG: 0 } }],
  duration: 420,
  timeStep: 0.1,
  engineId: dallaMan2007.id,
};

mountApp(root, {
  model,
  binding: bindingResult.binding,
  run: dallaMan2007.run(scenario, params.set),
  scenarioLabel: 'A 78 g carbohydrate meal at 0 min, average normal subject',
  modelLabel: 'Dalla Man, Rizza & Cobelli 2007 meal model (curated SBML, BioModels BIOMD0000000379)',
});
