/**
 * Checks how the map is framed, and that panning stays inside each city.
 *
 * This exists because of a regression worth remembering. Mapbox's `maxBounds`
 * looks like the natural way to keep the view over a city, but it constrains
 * the whole viewport rather than the centre: it quietly zooms in until the box
 * fills the window. Paris was rendering at zoom 10.394 instead of 10.2 on a
 * 1440px screen and 10.809 on a 1920px one, so every city was framed wrongly
 * and differently depending on the window. Clamping the centre instead — which
 * is what the previous build did — leaves the framing alone.
 *
 * A flat one-colour style stands in for the real tiles, so this needs no
 * network and always gives the same answer.
 *
 * Usage: node test/map-framing.cjs [baseUrl]
 */

const { chromium } = require('./playwright.cjs');

const BASE_URL = process.argv[2] || 'http://localhost:8080';

/** Must match site/map.js. */
const CITIES = {
  paris: { longitude: 2.395, latitude: 48.851, zoom: 10.2,
    bbox: [[2.0943827204, 48.7117011393], [2.6588734805, 49.035891562]] },
  london: { longitude: -0.048, latitude: 51.491, zoom: 10,
    bbox: [[-0.5945770815, 51.2468407724], [0.3375120088, 51.7292587128]] },
  nyc: { longitude: -73.917, latitude: 40.710, zoom: 10,
    bbox: [[-74.2740753571, 40.4853136705], [-73.8192439591, 40.8276099713]] },
};

const VIEWPORTS = [[1920, 1080], [1440, 900], [1024, 768], [390, 844]];

const FLAT_STYLE = JSON.stringify({
  version: 8, name: 'flat', sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f768a1' } }],
});

const problems = [];
const near = (a, b, tolerance = 1e-4) => Math.abs(a - b) < tolerance;

(async () => {
  const browser = await chromium.launch();

  for (const [width, height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.route(/(api|events)\.mapbox\.com/, (route) => route.abort());
    await page.route(/api\.mapbox\.com\/styles/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: FLAT_STYLE }));
    await page.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com/, (route) => route.abort());

    for (const [name, city] of Object.entries(CITIES)) {
      // A full reload each time: the two URLs differ only in the fragment, and
      // navigating between them would not re-run the page.
      await page.goto('about:blank');
      await page.goto(`${BASE_URL}/#/?city=${name}&language=en`, { waitUntil: 'load' });
      await page.waitForTimeout(1800);

      const view = await page.evaluate(() => {
        const centre = window.__map.getCenter();
        return { lng: centre.lng, lat: centre.lat, zoom: window.__map.getZoom() };
      });

      const framed = near(view.lng, city.longitude) && near(view.lat, city.latitude)
        && near(view.zoom, city.zoom, 1e-3);
      if (!framed) {
        problems.push(`${width}x${height} ${name}: framed at `
          + `${view.lng.toFixed(4)},${view.lat.toFixed(4)} z${view.zoom.toFixed(3)} — expected `
          + `${city.longitude},${city.latitude} z${city.zoom}`);
      }

      // Drag a long way in each direction; the centre must stay in the box.
      await page.getByRole('button', { name: /without sound/i }).click();
      const midX = Math.round(width * (width < 900 ? 0.5 : 0.7));
      const midY = Math.round(height * 0.4);
      for (const [dx, dy] of [[900, 0], [-1800, 0], [0, 900], [0, -1800]]) {
        await page.mouse.move(midX, midY);
        await page.mouse.down();
        await page.mouse.move(midX + dx, midY + dy, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(250);
      }

      const after = await page.evaluate(() => {
        const c = window.__map.getCenter();
        return { lng: c.lng, lat: c.lat, zoom: window.__map.getZoom() };
      });
      const [[west, south], [east, north]] = city.bbox;
      const slack = 1e-6;
      if (after.lng < west - slack || after.lng > east + slack
        || after.lat < south - slack || after.lat > north + slack) {
        problems.push(`${width}x${height} ${name}: panned out of bounds to `
          + `${after.lng.toFixed(4)},${after.lat.toFixed(4)}`);
      }

      // And you should not be able to zoom out past the city's own zoom.
      await page.evaluate(() => window.__map.setZoom(2));
      await page.waitForTimeout(300);
      const zoomedOut = await page.evaluate(() => window.__map.getZoom());
      if (zoomedOut < city.zoom - 1e-6) {
        problems.push(`${width}x${height} ${name}: zoomed out to ${zoomedOut} below ${city.zoom}`);
      }
    }

    console.log(`  ${width}x${height}: three cities framed, clamped and zoom-limited`);
    await context.close();
  }

  await browser.close();

  if (problems.length) {
    console.log('\n' + problems.join('\n'));
    console.log(`\nFAIL — ${problems.length} problems.`);
    process.exit(1);
  }
  console.log('\nPASS — every city is framed as configured and stays inside its box.');
})();
