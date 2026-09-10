/**
 * Checks the rewritten gauge produces byte-identical SVG path geometry to the
 * D3 original.
 *
 * test/fixtures/gauge-original.svg is the gauge as the React build actually
 * rendered it, captured from a running page. Comparing generated path strings
 * against it is a much sharper test than eyeballing screenshots: a needle
 * one-thousandth of a radian out shows up here immediately.
 *
 * Usage: node test/gauge-geometry.cjs
 */

const fs = require('fs');
const path = require('path');

const ORIGINAL = path.join(__dirname, 'fixtures', 'gauge-original.svg');

(async () => {
  const svg = fs.readFileSync(ORIGINAL, 'utf8');

  // The nine dial segments, in document order, with their fill and path.
  const originalArcs = [...svg.matchAll(/<path fill="(#[0-9a-f]{6})" d="([^"]+)"/g)]
    .map((m) => ({ color: m[1], d: m[2] }));

  // The tick labels: position, rotation and text.
  const originalTicks = [...svg.matchAll(
    /<text transform="translate\(([-\d.]+),\s*([-\d.]+)\)\s*rotate\(([-\d.]+)\)"[^>]*font-size="([\d.]+)">(\d+)<\/text>/g
  )].map((m) => ({
    x: parseFloat(m[1]), y: parseFloat(m[2]), rotate: parseFloat(m[3]),
    fontSize: parseFloat(m[4]), text: m[5],
  }));

  const { _internal } = await import('../site/gauge.js');
  const { layOutSegments, arcPath, INNER_RADIUS, OUTER_RADIUS } = _internal;
  const segments = layOutSegments();

  const problems = [];

  if (originalArcs.length !== 9) problems.push(`expected 9 arcs in the fixture, found ${originalArcs.length}`);
  if (originalTicks.length !== 8) problems.push(`expected 8 tick labels in the fixture, found ${originalTicks.length}`);

  segments.forEach((segment, i) => {
    const original = originalArcs[i];
    if (!original) return;
    const generated = arcPath(INNER_RADIUS, OUTER_RADIUS, segment.startAngle, segment.endAngle);
    if (generated !== original.d) {
      problems.push(`arc ${i} (${segment.step.value} dB) path differs:\n    original:  ${original.d}\n    generated: ${generated}`);
    }
    if (segment.step.color !== original.color) {
      problems.push(`arc ${i} fill: original ${original.color}, generated ${segment.step.color}`);
    }
  });

  // Tick labels: compare positions to within a rounding step, and the rotation
  // exactly -- the radians-as-degrees quirk has to survive.
  const SIZE = 230 * 0.85;
  const TICK_RADIUS = SIZE * 0.55;
  segments.slice(1).forEach((segment, i) => {
    const original = originalTicks[i];
    if (!original) return;
    const x = TICK_RADIUS * Math.sin(segment.startAngle);
    const y = -TICK_RADIUS * Math.cos(segment.startAngle);
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    if (!near(x, original.x) || !near(y, original.y)) {
      problems.push(`tick ${original.text}: position (${x}, ${y}) vs original (${original.x}, ${original.y})`);
    }
    if (!near(segment.startAngle, original.rotate)) {
      problems.push(`tick ${original.text}: rotation ${segment.startAngle} vs original ${original.rotate}`);
    }
    if (segment.step.label !== original.text) {
      problems.push(`tick ${i}: label "${segment.step.label}" vs original "${original.text}"`);
    }
  });

  console.log(`dial segments : ${segments.length} compared`);
  console.log(`tick labels   : ${originalTicks.length} compared`);

  if (problems.length) {
    console.log('\n' + problems.join('\n'));
    console.log(`\nFAIL — ${problems.length} differences from the original gauge.`);
    process.exit(1);
  }
  console.log('\nPASS — geometry is identical to the D3 original.');
})();
