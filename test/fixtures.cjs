/**
 * Deterministic network fixtures for the screenshot harness.
 *
 * Google Fonts is served from a local cache rather than the network. Two
 * reasons: a run captures hundreds of screenshots, and a single slow or dropped
 * font response would silently reflow every piece of text on the page; and the
 * comparison should be measuring our markup, not the weather on someone else's
 * CDN. The cache is populated by test/fixtures/fonts/ (see README).
 *
 * Analytics is blocked outright — it draws nothing and only adds variance.
 */

const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, 'fixtures', 'fonts');

/** gstatic URLs map to cached files by flattening their path: a/b.woff2 -> a_b.woff2 */
function cachedFontFile(url) {
  const rel = url.replace('https://fonts.gstatic.com/', '').split('?')[0];
  return path.join(FONT_DIR, rel.replace(/\//g, '_'));
}

async function installFixtures(page) {
  // Stylesheets: pick the cached CSS matching the family being requested.
  await page.route('https://fonts.googleapis.com/**', async (route) => {
    const url = route.request().url();
    const file = path.join(FONT_DIR, /Poppins/i.test(url) ? 'poppins.css' : 'others.css');
    if (!fs.existsSync(file)) return route.abort();
    await route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: fs.readFileSync(file, 'utf8'),
    });
  });

  // The font binaries themselves.
  await page.route('https://fonts.gstatic.com/**', async (route) => {
    const file = cachedFontFile(route.request().url());
    if (!fs.existsSync(file)) return route.abort();
    await route.fulfill({
      status: 200,
      contentType: 'font/woff2',
      body: fs.readFileSync(file),
    });
  });

  await page.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort());

  /*
   * Mapbox is blocked outright. The map canvas is hidden before every capture,
   * so tiles contribute nothing to the comparison -- but letting the style
   * request through would mean the attribution control is populated on runs
   * where the network cooperates and empty on runs where it doesn't, failing
   * screenshots for reasons that have nothing to do with the code. Blocking it
   * makes both runs identical. The map itself is verified by hand on the
   * deploy preview, where it talks to the real Mapbox.
   */
  await page.route(/(api|events)\.mapbox\.com/, (route) => route.abort());
}

module.exports = { installFixtures };
