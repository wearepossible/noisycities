/**
 * End-to-end check of the hover pipeline: map pixel -> decibel reading ->
 * gauge needle, tooltip swatch and audio volume.
 *
 * Rather than depend on real map tiles, this serves Mapbox a minimal style
 * whose only layer is a flat background in a known colour from the scale. The
 * map genuinely renders it through WebGL, so the sampling path being tested is
 * the real one -- readPixels and all -- but the expected reading is known
 * exactly, and the test does not depend on the network or on what the tiles
 * happen to look like at a given zoom.
 *
 * Usage: NODE_PATH=/opt/node22/lib/node_modules node test/hover-pipeline.cjs [baseUrl]
 */

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = process.argv[2] || 'http://localhost:8080';

/** Colour under the cursor -> the reading, label and volume it should produce. */
const CASES = [
  { color: '#feebe2', value: 35, label: '< 40 dB', volume: 0.1 },
  { color: '#f768a1', value: 55, label: '55 dB', volume: 0.55 },
  { color: '#7a0177', value: 75, label: '75 dB', volume: 1 },
  { color: '#a00e81', value: 70, label: '70 dB', volume: 0.8875 },
  // Unmeasured ground: no needle, no label, silence.
  { color: '#d5d5d5', value: -1, label: '', volume: 0 },
  { color: '#ffffff', value: -4, label: '', volume: 0 },
];

const flatStyle = (color) => JSON.stringify({
  version: 8,
  name: 'flat',
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': color } }],
});

(async () => {
  const browser = await chromium.launch();
  const failures = [];

  for (const testCase of CASES) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const page = await context.newPage();

    /*
     * Refuse everything Mapbox asks for, then serve the flat style. The order
     * matters: Playwright tries the most recently registered handler first, so
     * the specific rule has to be added after the catch-all.
     */
    await page.route(/(api|events)\.mapbox\.com/, (route) => route.abort());
    await page.route(/api\.mapbox\.com\/styles/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: flatStyle(testCase.color) })
    );
    await page.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com/, (route) => route.abort());

    await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
    await page.getByRole('button', { name: /without sound/i }).click();

    // Wait for the background to actually be painted before sampling.
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.mapboxgl-canvas');
      if (!canvas) return false;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return false;
      const px = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px[0] + px[1] + px[2] > 0;
    }, null, { timeout: 20000 });

    await page.mouse.move(800, 400);
    await page.waitForTimeout(300);

    const actual = await page.evaluate(() => ({
      label: (document.querySelector('.gaugeLabel')?.textContent || '').trim(),
      needleShown: document.querySelector('.gaugePin')?.style.opacity === '1',
      tooltipShown: !document.getElementById('tooltip').hidden,
      swatch: document.querySelector('.tooltip-swatch')?.style.backgroundColor,
      volume: Number(document.getElementById('noise-audio').volume.toFixed(6)),
    }));

    const measured = testCase.value > 0;
    const problems = [];
    if (actual.label !== testCase.label) problems.push(`label "${actual.label}" != "${testCase.label}"`);
    if (actual.needleShown !== measured) problems.push(`needle shown ${actual.needleShown}, expected ${measured}`);
    if (Math.abs(actual.volume - testCase.volume) > 1e-6) problems.push(`volume ${actual.volume} != ${testCase.volume}`);
    if (!actual.tooltipShown) problems.push('tooltip not shown while over the map');

    // Leaving the map must silence it and clear the readout.
    await page.mouse.move(20, 400);
    await page.waitForTimeout(300);
    const off = await page.evaluate(() => ({
      tooltipShown: !document.getElementById('tooltip').hidden,
      volume: document.getElementById('noise-audio').volume,
    }));
    if (off.tooltipShown) problems.push('tooltip still shown after leaving the map');
    if (off.volume !== 0) problems.push(`volume ${off.volume} after leaving the map, expected 0`);

    const status = problems.length ? 'FAIL' : 'ok';
    console.log(`  ${testCase.color} -> ${testCase.value} dB  ${status}`
      + (problems.length ? '\n      ' + problems.join('\n      ') : `  (${actual.label || 'silent'}, volume ${actual.volume})`));
    if (problems.length) failures.push(testCase.color);

    await context.close();
  }

  await browser.close();

  if (failures.length) {
    console.log(`\nFAIL — ${failures.length} of ${CASES.length} cases wrong.`);
    process.exit(1);
  }
  console.log(`\nPASS — all ${CASES.length} cases produce the right reading, gauge and volume.`);
})();
