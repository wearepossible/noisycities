/**
 * The phone map: the whole city at once, a locked view, and a finger that
 * reads it rather than drags it.
 *
 * On a narrow screen the per-city zoom was chosen for a wide desktop pane, so
 * it landed halfway into the city with no way to see the rest. The map is now
 * fitted to the city's whole box and pinned there, panning and pinching are
 * off, and a touch sweeps across the map the way a mouse does on a desktop.
 *
 * As elsewhere, a flat one-colour style stands in for real tiles, so the
 * reading a touch should produce is known exactly and nothing depends on the
 * network.
 *
 * Usage: node test/phone-map.cjs [baseUrl]
 */

const { chromium } = require('./playwright.cjs');

const BASE_URL = process.argv[2] || 'http://localhost:8080';

/**
 * The data extents from site/map.js -- what a phone fits, and what Mapbox
 * reports as the bounds of each city's raster tileset. Not the panning boxes,
 * which are a different thing and much smaller for New York.
 */
const CITIES = {
  paris: [[2.142892, 48.644667], [2.616554, 49.012584]],
  london: [[-0.544443, 51.265005], [0.335147, 51.717497]],
  nyc: [[-74.442611, 40.307184], [-73.467639, 41.066593]],
};

const PHONES = [
  { label: 'iPhone 14', width: 390, height: 844 },
  { label: 'iPhone SE', width: 320, height: 568 },
  { label: 'iPhone XR', width: 414, height: 896 },
  { label: 'landscape', width: 844, height: 390 },
];

const FLAT_STYLE = JSON.stringify({
  version: 8, name: 'flat', sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f768a1' } }],
});

// fitBounds lands the edges exactly on the viewport, so the comparison needs
// room for floating point rather than for any real margin.
const EPSILON = 1e-9;

const problems = [];

async function routeMap(page) {
  await page.route(/(api|events)\.mapbox\.com/, (route) => route.abort());
  await page.route(/api\.mapbox\.com\/styles/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: FLAT_STYLE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com/, (route) => route.abort());
}

/** A real touch drag, which Playwright's touchscreen cannot express. */
async function touchDrag(page, path) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: path[0][0], y: path[0][1] }],
  });
  for (const [x, y] of path.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(80);
  }
  return {
    end: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  };
}

(async () => {
  const browser = await chromium.launch();

  for (const phone of PHONES) {
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await routeMap(page);

    for (const [name, bbox] of Object.entries(CITIES)) {
      await page.goto('about:blank');
      await page.goto(`${BASE_URL}/#/?city=${name}&language=en`, { waitUntil: 'load' });
      await page.waitForTimeout(1500);

      const view = await page.evaluate(() => {
        const map = window.__map;
        const bounds = map.getBounds();
        return {
          west: bounds.getWest(), east: bounds.getEast(),
          south: bounds.getSouth(), north: bounds.getNorth(),
          zoom: map.getZoom(), minZoom: map.getMinZoom(), maxZoom: map.getMaxZoom(),
          dragPan: map.dragPan.isEnabled(),
          pinch: map.touchZoomRotate.isEnabled(),
          scroll: map.scrollZoom.isEnabled(),
          navControl: Boolean(document.querySelector('.mapboxgl-ctrl-zoom-in')),
        };
      });

      const [[west, south], [east, north]] = bbox;
      const where = `${phone.label} ${name}`;
      if (view.west > west + EPSILON || view.east < east - EPSILON
        || view.south > south + EPSILON || view.north < north - EPSILON) {
        problems.push(`${where}: the whole city is not on screen`);
      }
      // Zoomed all the way out, so the whole city is the furthest you can go.
      if (Math.abs(view.zoom - view.minZoom) > 1e-6) {
        problems.push(`${where}: opens at ${view.zoom}, not its minimum ${view.minZoom}`);
      }
      if (view.maxZoom <= view.minZoom) problems.push(`${where}: no room left to pinch in`);
      if (view.dragPan) problems.push(`${where}: dragging still pans`);
      if (!view.pinch) problems.push(`${where}: pinch to zoom is disabled`);
      if (view.scroll) problems.push(`${where}: scroll zoom still enabled`);
      if (view.navControl) problems.push(`${where}: zoom buttons still shown on a locked map`);
    }

    // Scrubbing, on one city per phone.
    await page.goto('about:blank');
    await page.goto(`${BASE_URL}/#/?city=paris&language=en`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /without sound/i }).click();
    await page.waitForTimeout(300);

    /*
     * Scroll the map into view first. Touch coordinates are viewport
     * coordinates, and on a short screen the middle of the map starts below
     * the fold -- a touch aimed there would land on nothing at all.
     */
    await page.locator('#map').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const mapBox = await page.locator('#map').boundingBox();
    const y = Math.round(mapBox.y + mapBox.height * 0.5);
    const before = await page.evaluate(() => {
      const c = window.__map.getCenter();
      return { lng: c.lng, lat: c.lat };
    });

    const drag = await touchDrag(page, [
      [Math.round(mapBox.x + mapBox.width * 0.3), y],
      [Math.round(mapBox.x + mapBox.width * 0.5), y],
      [Math.round(mapBox.x + mapBox.width * 0.7), y],
    ]);

    const during = await page.evaluate(() => ({
      label: (document.querySelector('.gaugeLabel')?.textContent || '').trim(),
      tooltipShown: !document.getElementById('tooltip').hidden,
      volume: window.__audio.volume,
      lng: window.__map.getCenter().lng,
    }));

    await drag.end();
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => ({
      tooltipShown: !document.getElementById('tooltip').hidden,
      volume: window.__audio.volume,
    }));

    const where = `${phone.label} scrub`;
    if (during.label !== '55 dB') problems.push(`${where}: gauge read "${during.label}", expected "55 dB"`);
    if (!during.tooltipShown) problems.push(`${where}: no tooltip while a finger is down`);
    if (Math.abs(during.volume - 0.55) > 1e-6) problems.push(`${where}: volume ${during.volume}, expected 0.55`);
    if (Math.abs(during.lng - before.lng) > 1e-9) problems.push(`${where}: the map panned under the finger`);
    if (after.tooltipShown) problems.push(`${where}: tooltip still shown after lifting`);
    if (after.volume !== 0) problems.push(`${where}: volume ${after.volume} after lifting, expected 0`);

    console.log(`  ${phone.label.padEnd(10)} ${phone.width}x${phone.height}: whole city, locked, scrubs`);
    await context.close();
  }

  await browser.close();

  if (problems.length) {
    console.log('\n' + problems.join('\n'));
    console.log(`\nFAIL — ${problems.length} problems.`);
    process.exit(1);
  }
  console.log('\nPASS — phones show the whole city and read it by touch.');
})();
