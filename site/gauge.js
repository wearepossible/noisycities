/**
 * The noise gauge in the legend: a nine-segment dial with a needle that swings
 * to the reading under the cursor.
 *
 * This replaces roughly 290 lines of imperative D3 (a chart base class, a
 * subclass, and a React class component that destroyed and rebuilt the whole
 * chart on every window resize). The geometry never changes, so the arcs are
 * built once and only the needle and the label move.
 */

import { MEASURED_STEPS } from './steps.js';

// --- Geometry -------------------------------------------------------------
// The legend is a fixed 250px circle with 5px of padding, so the chart is
// always the same size. The original recomputed all of this from the
// container's width on every resize; it always arrived at these same numbers.

const MARGIN = 5;
const WIDTH = 230;
const HEIGHT = 158;
const SIZE = WIDTH * 0.85;
const RADIUS = SIZE / 2;
const INNER_RADIUS = RADIUS * 0.8;
const OUTER_RADIUS = RADIUS - 1;

const START_ANGLE = -Math.PI * 0.6;
const END_ANGLE = Math.PI * 0.6;
const PAD_ANGLE = 0.015;

const NEEDLE_OFFSET = -SIZE * 0.4;
const LABEL_FONT_SIZE = SIZE * 0.2;
const TICK_RADIUS = SIZE * 0.55;
const TICK_FONT_SIZE = SIZE * 0.05;

/**
 * The triangular needle, at the size D3's default symbol produced. Hardcoded
 * because it is a constant: three points that never move.
 */
const NEEDLE_PATH = 'M0,-7.019L6.079,3.51L-6.079,3.51Z';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Angles run clockwise from twelve o'clock; SVG's y axis points down. */
const pointX = (radius, angle) => radius * Math.sin(angle);
const pointY = (radius, angle) => -radius * Math.cos(angle);

/** D3 emits path coordinates rounded to three decimal places. */
const round = (n) => Math.round(n * 1000) / 1000;

/**
 * Lay the measured steps out as equal segments across the dial's arc.
 *
 * Each segment's angular span includes the gap that follows it, which is how
 * D3's pie layout expressed padding; the gap itself is cut out later, by
 * insetting the drawn edges.
 */
function layOutSegments() {
  const count = MEASURED_STEPS.length;
  const span = (END_ANGLE - START_ANGLE - count * PAD_ANGLE) / count;

  return MEASURED_STEPS.map((step, index) => {
    const startAngle = START_ANGLE + index * (span + PAD_ANGLE);
    return { step, startAngle, endAngle: startAngle + span + PAD_ANGLE };
  });
}

/**
 * An annular sector with padded edges.
 *
 * The inner and outer edges are inset by different angles so the gap between
 * segments stays a constant *distance* rather than a constant angle — without
 * this the gaps visibly splay open towards the outside of the dial. The two
 * inset angles are derived the same way D3's arc generator derived them.
 */
function arcPath(innerRadius, outerRadius, startAngle, endAngle) {
  const padRadius = Math.sqrt(innerRadius * innerRadius + outerRadius * outerRadius);
  const halfPad = PAD_ANGLE / 2;
  const innerInset = Math.asin((padRadius / innerRadius) * Math.sin(halfPad));
  const outerInset = Math.asin((padRadius / outerRadius) * Math.sin(halfPad));

  const outerStart = startAngle + outerInset;
  const outerEnd = endAngle - outerInset;
  const innerStart = startAngle + innerInset;
  const innerEnd = endAngle - innerInset;

  const largeArc = outerEnd - outerStart > Math.PI ? 1 : 0;

  return [
    `M${round(pointX(outerRadius, outerStart))},${round(pointY(outerRadius, outerStart))}`,
    `A${outerRadius},${outerRadius},0,${largeArc},1,`
      + `${round(pointX(outerRadius, outerEnd))},${round(pointY(outerRadius, outerEnd))}`,
    `L${round(pointX(innerRadius, innerEnd))},${round(pointY(innerRadius, innerEnd))}`,
    `A${innerRadius},${innerRadius},0,${largeArc},0,`
      + `${round(pointX(innerRadius, innerStart))},${round(pointY(innerRadius, innerStart))}`,
    'Z',
  ].join('');
}

function element(name, attributes) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }
  return node;
}

/**
 * Build the gauge inside `container`.
 *
 * @returns {{ setValue: (value: number|null) => void }} `setValue` takes a
 *   decibel reading; anything unmeasured or absent hides the needle.
 */
export function createGauge(container) {
  const segments = layOutSegments();

  const svg = element('svg', {
    class: 'chart',
    width: WIDTH + MARGIN * 2,
    height: HEIGHT + MARGIN * 2,
  });
  const root = element('g', { transform: `translate(${MARGIN}, ${MARGIN})` });
  const main = element('g', {
    class: 'main',
    transform: `translate(${WIDTH / 2}, ${WIDTH / 2})`,
  });

  // The coloured dial.
  const dial = element('g', { class: 'gauge' });
  for (const { step, startAngle, endAngle } of segments) {
    dial.append(element('path', {
      fill: step.color,
      d: arcPath(INNER_RADIUS, OUTER_RADIUS, startAngle, endAngle),
    }));
  }

  /*
   * Tick labels, one per boundary between segments — so every step except the
   * first, each sitting at the start of its own segment.
   *
   * The rotation is deliberately passed in radians. SVG reads it as degrees,
   * which means each label is tilted by about a degree and a half instead of
   * being turned to follow the dial. That is what the original did and what
   * the site has always looked like, so it is reproduced exactly rather than
   * corrected into a visible tilt. Please leave it alone.
   */
  for (const { step, startAngle } of segments.slice(1)) {
    const group = element('g', { class: 'tick-label' });
    const label = element('text', {
      transform: `translate(${pointX(TICK_RADIUS, startAngle)}, ${pointY(TICK_RADIUS, startAngle)})`
        + ` rotate(${startAngle})`,
      dy: '0.35em',
      'text-anchor': 'middle',
      'font-size': TICK_FONT_SIZE,
    });
    label.textContent = step.label;
    group.append(label);
    dial.append(group);
  }

  // The needle. Its own transition is CSS; D3 was animating the same property.
  const needle = element('g', { class: 'gaugePin' });
  needle.style.opacity = '0';
  needle.append(element('path', {
    transform: `translate(0, ${NEEDLE_OFFSET})`,
    d: NEEDLE_PATH,
    fill: 'black',
  }));

  const readout = element('text', { class: 'gaugeLabel' });
  readout.style.opacity = '0';

  main.append(dial, needle, readout);
  root.append(main);
  svg.append(root);
  container.append(svg);

  /** Point the needle at a reading, or hide it if there is nothing to show. */
  function setValue(value) {
    const segment = value ? segments.find((s) => s.step.value === value) : undefined;

    if (!segment) {
      needle.style.opacity = '0';
      readout.style.opacity = '0';
      return;
    }

    const middle = (segment.startAngle + segment.endAngle) / 2;
    needle.setAttribute('transform', `rotate(${middle * (180 / Math.PI)})`);
    needle.style.opacity = '1';

    readout.setAttribute('font-size', LABEL_FONT_SIZE);
    readout.setAttribute('text-anchor', 'middle');
    readout.textContent = `${segment.step.label} dB`;
    readout.style.opacity = '1';
  }

  return { setValue };
}

/** Exported for the geometry test, which checks these against the original. */
export const _internal = { layOutSegments, arcPath, INNER_RADIUS, OUTER_RADIUS };
