/**
 * Proves the rewritten colour matching and volume curve behave identically to
 * the libraries they replace.
 *
 * The original path went: pixel bytes -> "rgba(r, g, b, a)" string -> regex ->
 * hex string -> nearest-color -> step value, with a lodash-built lookup table
 * rebuilt on every mouse move; and a d3 linear scale for the volume. This
 * reproduces that path verbatim and checks the new code agrees on every
 * palette colour and a deterministic sweep of RGB space.
 *
 * It only runs while the old packages are still installed, so once they are
 * removed it reports a skip rather than failing. It is a migration proof, not
 * an ongoing test.
 *
 * Usage: node test/colour-parity.cjs
 */

let _, nearestColor, d3;
try {
  _ = require('lodash');
  nearestColor = require('nearest-color');
  d3 = require('d3');
} catch (err) {
  console.log('SKIP — the original packages are no longer installed.');
  console.log('       (This check ran against them at migration time.)');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// The original implementation, copied verbatim from src/App.js.
// ---------------------------------------------------------------------------

const steps = [
  { value: 35, label: '< 40', color: '#feebe2' },
  { value: 40, label: '40', color: '#fdd0ce' },
  { value: 45, label: '45', color: '#fbb4b9' },
  { value: 50, label: '50', color: '#f98ead' },
  { value: 55, label: '55', color: '#f768a1' },
  { value: 60, label: '60', color: '#de4196' },
  { value: 65, label: '65', color: '#c51b8a' },
  { value: 70, label: '70', color: '#a00e81' },
  { value: 75, label: '75', color: '#7a0177' },
  { value: -1, label: 'NA', color: '#d5d5d5' },
  { value: -2, label: 'NA', color: '#eef0f0' },
  { value: -4, label: 'NA', color: '#ffffff' },
  { value: -5, label: 'NA', color: '#cccccc' },
];

const rgba2hex = (orig) => {
  let rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i);
  let hex = rgb
    ? (rgb[1] | (1 << 8)).toString(16).slice(1) +
      (rgb[2] | (1 << 8)).toString(16).slice(1) +
      (rgb[3] | (1 << 8)).toString(16).slice(1)
    : orig;
  return hex;
};

function originalStepValue(r, g, b, a = 255) {
  const color = `rgba(${r}, ${g}, ${b}, ${a})`;
  const colors = _(steps).keyBy('value').mapValues('color').value();
  const colorHex = `#${rgba2hex(color)}`;
  return +nearestColor.from(colors)(colorHex).name;
}

const originalVolumeScale = d3
  .scaleLinear()
  .domain(d3.extent(steps, (d) => (d.value > 0 ? d.value : null)))
  .range([0.1, 1]);

const originalVolume = (value) => (value < 0 ? 0 : originalVolumeScale(value));

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

(async () => {
  const { nearestStepValue, volumeFor } = await import('../site/colours.js');

  let checked = 0;
  const mismatches = [];

  const check = (r, g, b) => {
    checked++;
    const expected = originalStepValue(r, g, b);
    const actual = nearestStepValue(r, g, b);
    if (expected !== actual) {
      mismatches.push(`rgb(${r},${g},${b}): expected ${expected}, got ${actual}`);
    }
  };

  // Every palette colour exactly.
  for (const step of steps) {
    check(
      parseInt(step.color.slice(1, 3), 16),
      parseInt(step.color.slice(3, 5), 16),
      parseInt(step.color.slice(5, 7), 16)
    );
  }

  // A deterministic sweep of the whole cube, plus every palette colour nudged
  // by one in each channel — the cases where a tie-break could diverge.
  for (let r = 0; r < 256; r += 5) {
    for (let g = 0; g < 256; g += 5) {
      for (let b = 0; b < 256; b += 5) check(r, g, b);
    }
  }
  for (const step of steps) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(step.color.slice(i, i + 2), 16));
    for (const d of [-1, 1]) {
      check(Math.max(0, Math.min(255, r + d)), g, b);
      check(r, Math.max(0, Math.min(255, g + d)), b);
      check(r, g, Math.max(0, Math.min(255, b + d)));
    }
  }

  // The volume curve, at every step and across the readable range.
  const volumeMismatches = [];
  for (const step of steps) {
    if (originalVolume(step.value) !== volumeFor(step.value)) {
      volumeMismatches.push(`step ${step.value}`);
    }
  }
  for (let v = 35; v <= 75; v += 0.5) {
    if (Math.abs(originalVolume(v) - volumeFor(v)) > Number.EPSILON * 8) {
      volumeMismatches.push(`value ${v}: ${originalVolume(v)} vs ${volumeFor(v)}`);
    }
  }

  console.log(`colour matching : ${checked} samples, ${mismatches.length} mismatches`);
  console.log(`volume curve    : ${volumeMismatches.length} mismatches`);

  if (mismatches.length || volumeMismatches.length) {
    [...mismatches, ...volumeMismatches].slice(0, 10).forEach((m) => console.log('  ' + m));
    console.log('\nFAIL');
    process.exit(1);
  }
  console.log('\nPASS — the rewrite matches the original on every sample.');
})();
