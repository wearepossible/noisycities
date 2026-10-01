/**
 * The phone map: the whole city at once, one finger that reads it, and two
 * that move it.
 *
 * On a narrow screen the per-city zoom was chosen for a wide desktop pane, so
 * it landed halfway into the city with no way to see the rest. The map is now
 * fitted to the city's whole box and pinned there, one finger sweeps across
 * it the way a mouse does on a desktop, and panning and pinching are left to
 * two.
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
 * The data extents from site/map.js -- what a phone fits. Measured from the
 * tiles rather than taken from the bounds Mapbox declares for them, which for
 * New York describe a canvas nearly twice the size of the city. Not the
 * panning boxes either, which are a different thing again.
 */
const CITIES = {
  paris: [[2.145081, 48.645613], [2.616119, 49.012654]],
  london: [[-0.510864, 51.289406], [0.307617, 51.692990]],
  nyc: [[-74.256592, 40.496048], [-73.700409, 40.915588]],
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

/**
 * A real touch drag, which Playwright's touchscreen cannot express -- it only
 * offers a tap.
 *
 * Takes one path of [x, y] steps per finger, all the same length. Two fingers
 * moving in step is a pan with no pinch in it, which is what the map should
 * read it as.
 */
async function touchDrag(page, paths) {
  const cdp = await page.context().newCDPSession(page);
  const step = (i) => paths.map((path, id) => ({ x: path[i][0], y: path[i][1], id }));

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: step(0) });
  for (let i = 1; i < paths[0].length; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: step(i) });
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
          cooperative: map.getCooperativeGestures(),
          pinch: map.touchZoomRotate.isEnabled(),
          scroll: map.scrollZoom.isEnabled(),
          navControl: Boolean(document.querySelector('.mapboxgl-ctrl-zoom-in')),
          creditLeft: Boolean(
            document.querySelector('.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-attrib')
          ),
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
      if (!view.dragPan) problems.push(`${where}: two fingers cannot pan`);
      if (!view.cooperative) problems.push(`${where}: one finger would still pan the map`);
      if (!view.pinch) problems.push(`${where}: pinch to zoom is disabled`);
      if (view.scroll) problems.push(`${where}: scroll zoom still enabled`);
      if (view.navControl) problems.push(`${where}: zoom buttons still shown on a locked map`);
      if (!view.creditLeft) problems.push(`${where}: the credit still sits in the dial's corner`);
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
      return { lng: c.lng, lat: c.lat, scrollY: window.scrollY };
    });

    const drag = await touchDrag(page, [[
      [Math.round(mapBox.x + mapBox.width * 0.3), y],
      [Math.round(mapBox.x + mapBox.width * 0.5), y],
      [Math.round(mapBox.x + mapBox.width * 0.7), y],
    ]]);

    const during = await page.evaluate(() => ({
      label: (document.querySelector('.gaugeLabel')?.textContent || '').trim(),
      tooltipShown: !document.getElementById('tooltip').hidden,
      volume: window.__audio.volume,
      lng: window.__map.getCenter().lng,
      scrollY: window.scrollY,
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
    if (during.scrollY !== before.scrollY) problems.push(`${where}: the page scrolled under the finger`);
    if (after.tooltipShown) problems.push(`${where}: tooltip still shown after lifting`);
    if (after.volume !== 0) problems.push(`${where}: volume ${after.volume} after lifting, expected 0`);

    /*
     * Two fingers. Zoomed all the way out the view is wider than the city on
     * both axes, so the clamp holds the city centred and a two-finger drag
     * must leave it exactly where it was. Pinched in, the same drag must move
     * it.
     */
    const twoFingerDrag = async () => {
      const box = await page.locator('#map').boundingBox();
      const row = Math.round(box.y + box.height * 0.5);
      const left = Math.round(box.x + box.width * 0.35);
      const right = Math.round(box.x + box.width * 0.65);
      const pan = await touchDrag(page, [
        [[left, row], [left - 30, row], [left - 60, row]],
        [[right, row], [right - 30, row], [right - 60, row]],
      ]);
      await pan.end();
      await page.waitForTimeout(500);
      return page.evaluate(() => window.__map.getCenter().lng);
    };

    const pinnedFrom = await page.evaluate(() => window.__map.getCenter().lng);
    const pinnedTo = await twoFingerDrag();
    if (Math.abs(pinnedTo - pinnedFrom) > 1e-9) {
      problems.push(`${phone.label} two fingers: the city left the middle at its furthest-out zoom`);
    }

    /*
     * Three zoom levels in, not one or two. In landscape the city is fitted
     * by its height, so the view is still wider than the city two levels in
     * and the clamp is quite right to hold it where it is.
     */
    await page.evaluate(() => window.__map.jumpTo({ zoom: window.__map.getMinZoom() + 3 }));
    await page.waitForTimeout(400);
    const zoomedFrom = await page.evaluate(() => window.__map.getCenter().lng);
    const zoomedTo = await twoFingerDrag();
    if (Math.abs(zoomedTo - zoomedFrom) < 1e-6) {
      problems.push(`${phone.label} two fingers: zoomed in, the map did not pan`);
    }

    console.log(`  ${phone.label.padEnd(10)} ${phone.width}x${phone.height}: whole city, scrubs, two fingers pan`);
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
