// A small line chart: one measure, baseline and variant overlaid, a time cursor that follows
// playback, and a hover crosshair with a tooltip. One y-axis only.

const NS = 'http://www.w3.org/2000/svg';

export interface ChartSeries {
  label: string;
  /** CSS class giving the series colour: 'series-1' (baseline) or 'series-2' (variant). */
  className: string;
  times: number[];
  values: number[];
}

export interface ChartOptions {
  title: string;
  unit: string;
  series: ChartSeries[];
  duration: number;
}

export interface Chart {
  element: HTMLElement;
  setTime(t: number): void;
}

const W = 520;
const H = 200;
const M = { top: 16, right: 16, bottom: 28, left: 44 };

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

/** Round numbers for axis ticks. */
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function valueAt(s: ChartSeries, t: number): number {
  const i = Math.max(0, Math.min(s.times.length - 1, Math.round(t - (s.times[0] ?? 0))));
  return s.values[i]!;
}

export function createChart(opts: ChartOptions): Chart {
  const figure = document.createElement('figure');
  figure.className = 'chart';
  const caption = document.createElement('figcaption');
  caption.textContent = `${opts.title} (${opts.unit}), by minutes after the meal`;
  figure.append(caption);

  const all = opts.series.flatMap((s) => s.values);
  const ticksY = niceTicks(Math.min(...all), Math.max(...all));
  const yMin = Math.min(ticksY[0]!, Math.min(...all));
  const yMax = Math.max(ticksY[ticksY.length - 1]!, Math.max(...all));
  const x = (t: number) => M.left + (t / opts.duration) * (W - M.left - M.right);
  const y = (v: number) => H - M.bottom - ((v - yMin) / (yMax - yMin || 1)) * (H - M.top - M.bottom);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${opts.title} over time, ${opts.series.map((s) => s.label).join(' and ')}` });
  const grid = el('g', { class: 'grid' }, svg);
  for (const v of ticksY) {
    el('line', { x1: M.left, x2: W - M.right, y1: y(v), y2: y(v) }, grid);
    el('text', { x: M.left - 6, y: y(v) + 4, class: 'tick y' }, grid).textContent = String(v);
  }
  for (const t of niceTicks(0, opts.duration, 6)) {
    el('text', { x: x(t), y: H - 8, class: 'tick x' }, grid).textContent = `${t}`;
  }

  for (const s of opts.series) {
    const d = s.times.map((t, i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)},${y(s.values[i]!).toFixed(1)}`).join('');
    el('path', { d, class: `line ${s.className}` }, svg);
  }
  // Direct labels at each series' peak, where the lines are furthest apart, nudged if they collide.
  const peaks = opts.series.map((s) => {
    const i = s.values.indexOf(Math.max(...s.values));
    return { s, x: x(s.times[i]!), y: y(s.values[i]!) - 8 };
  }).sort((a, b) => a.y - b.y);
  for (let i = 1; i < peaks.length; i++) {
    const a = peaks[i - 1]!;
    const b = peaks[i]!;
    if (Math.abs(b.y - a.y) < 13 && Math.abs(b.x - a.x) < 60) b.y = a.y + 13;
  }
  for (const { s, x: lx, y: ly } of peaks) {
    el('text', { x: lx + 6, y: Math.max(M.top + 10, ly), class: 'direct-label' }, svg).textContent = s.label;
  }

  const cursor = el('line', { y1: M.top, y2: H - M.bottom, class: 'cursor' }, svg);
  const hover = el('g', { class: 'hover', visibility: 'hidden' }, svg);
  const hoverLine = el('line', { y1: M.top, y2: H - M.bottom }, hover);
  const dots = opts.series.map((s) => el('circle', { r: 4, class: `dot ${s.className}` }, hover));
  const hit = el('rect', { x: M.left, y: M.top, width: W - M.left - M.right, height: H - M.top - M.bottom, class: 'hit' }, svg);

  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  const legend = document.createElement('p');
  legend.className = 'chart-legend';
  for (const s of opts.series) {
    const k = document.createElement('span');
    k.className = `swatch ${s.className}`;
    k.textContent = s.label;
    legend.append(k);
  }
  const plot = document.createElement('div');
  plot.className = 'chart-plot';
  plot.append(svg, tip);
  figure.append(plot, legend);

  const showAt = (clientX: number) => {
    const box = svg.getBoundingClientRect();
    const sx = ((clientX - box.left) / box.width) * W;
    const t = Math.max(0, Math.min(opts.duration, ((sx - M.left) / (W - M.left - M.right)) * opts.duration));
    const rounded = Math.round(t);
    hover.setAttribute('visibility', 'visible');
    hoverLine.setAttribute('x1', String(x(rounded)));
    hoverLine.setAttribute('x2', String(x(rounded)));
    opts.series.forEach((s, i) => {
      dots[i]!.setAttribute('cx', String(x(rounded)));
      dots[i]!.setAttribute('cy', String(y(valueAt(s, rounded))));
    });
    tip.hidden = false;
    tip.replaceChildren();
    const head = document.createElement('strong');
    head.textContent = `${rounded} min`;
    tip.append(head);
    for (const s of opts.series) {
      const row = document.createElement('div');
      row.className = `swatch ${s.className}`;
      row.textContent = `${s.label}: ${valueAt(s, rounded).toFixed(0)} ${opts.unit}`;
      tip.append(row);
    }
    const px = (x(rounded) / W) * box.width;
    tip.style.left = `${Math.min(px + 12, box.width - 150)}px`;
  };
  hit.addEventListener('pointermove', (e) => showAt(e.clientX));
  hit.addEventListener('pointerdown', (e) => showAt(e.clientX));
  hit.addEventListener('pointerleave', () => {
    hover.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  });

  return {
    element: figure,
    setTime(t) {
      cursor.setAttribute('x1', String(x(t)));
      cursor.setAttribute('x2', String(x(t)));
    },
  };
}
