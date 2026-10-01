/**
 * Matching a pixel colour back to a decibel reading, and turning that reading
 * into an audio volume.
 *
 * Both run on every pointer move, so both avoid allocating.
 */

import { STEPS, MEASURED_STEPS } from './steps.js';

/**
 * The palette, parsed to numbers once at load.
 *
 * The previous implementation rebuilt a lookup table with lodash on every
 * mouse move, formatted the pixel as an "rgba(...)" string, parsed that back
 * out with a regular expression into hex, and handed the hex to a library
 * which parsed it into numbers again — all to compare three integers.
 */
const PALETTE = STEPS.map(({ value, color }) => ({
  value,
  r: parseInt(color.slice(1, 3), 16),
  g: parseInt(color.slice(3, 5), 16),
  b: parseInt(color.slice(5, 7), 16),
}));

/**
 * The step whose colour is closest to the given pixel, by squared Euclidean
 * distance in RGB space — the same metric, and the same first-match-wins tie
 * break, as the `nearest-color` package this replaces.
 *
 * @returns {number} the step's value: a decibel reading, or negative for
 *   unmeasured ground.
 */
export function nearestStepValue(r, g, b) {
  let nearest = PALETTE[0];
  let nearestDistance = Infinity;

  for (const step of PALETTE) {
    const dr = r - step.r;
    const dg = g - step.g;
    const db = b - step.b;
    const distance = dr * dr + dg * dg + db * db;

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = step;
    }
  }

  return nearest.value;
}

// The quietest and loudest readings on the scale, and the volumes they map to.
const QUIETEST = MEASURED_STEPS[0].value;
const LOUDEST = MEASURED_STEPS[MEASURED_STEPS.length - 1].value;
const QUIETEST_VOLUME = 0.1;
const LOUDEST_VOLUME = 1;

/**
 * Audio volume for a reading: a straight line from 0.1 at the quietest step to
 * 1 at the loudest. Unmeasured ground is silent.
 *
 * Replaces a d3 linear scale over the same domain and range.
 */
export function volumeFor(value) {
  if (!(value > 0)) return 0;

  const position = (value - QUIETEST) / (LOUDEST - QUIETEST);
  return QUIETEST_VOLUME + position * (LOUDEST_VOLUME - QUIETEST_VOLUME);
}
