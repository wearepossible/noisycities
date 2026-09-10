/**
 * Screenshot harness for the Noisy Cities interface.
 *
 * Captures the page across a matrix of viewports, pixel densities, languages,
 * cities and drawer states, so the plain-JavaScript rewrite can be compared
 * against the current React build pixel for pixel.
 *
 * The map canvas is deliberately MASKED. It is WebGL painting tiles fetched
 * asynchronously from Mapbox, so it never compares cleanly even against itself.
 * Everything else on the page is HTML, CSS and SVG and is expected to match
 * exactly.
 *
 * Usage:
 *   NODE_PATH=/opt/node22/lib/node_modules node test/capture.cjs <baseUrl> <outDir>
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { installFixtures } = require('./fixtures.cjs');

const [, , BASE_URL, OUT_DIR] = process.argv;
if (!BASE_URL || !OUT_DIR) {
  console.error('usage: node test/capture.cjs <baseUrl> <outDir>');
  process.exit(1);
}

/**
 * Real-height viewports test layout; the `tall` variants exist because the
 * desktop sidebar is a scrolling pane, so at a realistic height most of the
 * copy sits below the fold and would never be compared. Making the window tall
 * lets the whole sidebar render without mutating any CSS.
 */
const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x0900', width: 1440, height: 900 },
  { name: '1280x0800', width: 1280, height: 800 },
  { name: '1024x0768', width: 1024, height: 768 },
  { name: '0900x1000', width: 900, height: 1000 },   // exactly on the breakpoint
  { name: '0899x1000', width: 899, height: 1000 },   // one pixel below it
  { name: '0768x1024', width: 768, height: 1024 },
  { name: '0414x0896', width: 414, height: 896 },
  { name: '0390x0844', width: 390, height: 844 },
  { name: '0360x0740', width: 360, height: 740 },
  { name: '0320x0568', width: 320, height: 568 },
  { name: 'tall-1920', width: 1920, height: 3000, scales: [1] },
  { name: 'tall-1440', width: 1440, height: 3000, scales: [1] },
  { name: 'tall-1024', width: 1024, height: 3000, scales: [1] },
];

/** Default densities; a viewport may narrow this with its own `scales`. */
const SCALES = [1, 2];
const LANGUAGES = ['en', 'fr'];
const CITIES = ['paris', 'nyc', 'london'];

/**
 * While iterating on a difference it is much quicker to re-shoot one viewport
 * than all of them: CAPTURE_ONLY=1440x0900,0390x0844 narrows the run.
 */
const ONLY = process.env.CAPTURE_ONLY
  ? new Set(process.env.CAPTURE_ONLY.split(',').map((s) => s.trim()))
  : null;

// Neutralise anything that would make a screenshot depend on timing.
const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
  /*
   * Hide the WebGL canvases rather than masking them: visibility keeps their
   * layout box intact, so page geometry is unchanged, but the
   * non-deterministic pixels are gone. Crucially it leaves the HTML drawn on
   * top of the map -- the legend, the gauge, the navigation control -- visible
   * and comparable, which a mask rectangle would have covered up.
   */
  canvas { visibility: hidden !important; }
`;

/** Wait for the page to be visually settled: fonts loaded, map element present. */
async function settle(page) {
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready);
  // The map canvas may never appear if tiles fail; don't block the whole run on it.
  await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function shoot(page, file) {
  // Normalise scroll before every capture. A full-page screenshot includes the
  // whole document, but fixed and absolutely-positioned elements are painted
  // wherever the current scroll offset puts them, so an un-reset scroll makes
  // the drawer and legend land in different places between runs.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
}

/**
 * Click a control that may be below the fold on short viewports. Failures are
 * reported rather than thrown: one unreachable tab should not abandon a run of
 * two hundred screenshots, and a missing capture is caught by the comparison.
 */
async function clickIfPossible(locator, label) {
  try {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded({ timeout: 5000 });
    await el.click({ timeout: 8000 });
    return true;
  } catch (err) {
    console.warn(`\n  ! could not click ${label}: ${String(err.message).split('\n')[0]}`);
    return false;
  }
}

/**
 * The drawer can only be dismissed, never reopened, so each language needs its
 * own page load: one shot with the drawer up, then the cities behind it.
 */
async function captureState(page, dir, vp, scale, language) {
  const tag = `${vp.name}@${scale}x-${language}`;

  /*
   * Clear the page first. The two languages differ only in the fragment, and
   * navigating between two URLs that share a path is a same-document change:
   * the page would not reload, the script would not re-run, and the drawer
   * would still be dismissed from the previous pass.
   */
  await page.goto('about:blank');
  await page.goto(`${BASE_URL}/#/?city=paris&language=${language}`, { waitUntil: 'load' });
  await settle(page);
  await shoot(page, path.join(dir, `${tag}-drawer.png`));

  // "Without sound" leaves audio muted, matching the site's default state.
  const dismiss = page.getByRole('button', { name: /without sound/i });
  if (await dismiss.count()) {
    await clickIfPossible(dismiss, 'Without sound');
    await page.waitForTimeout(400);
  }

  for (const city of CITIES) {
    const label = cityLabel(city, language);
    const tab = page.getByRole('tab', { name: label, exact: true })
      .or(page.getByRole('button', { name: label, exact: true }));
    if (await tab.count()) {
      await clickIfPossible(tab, `city tab ${label}`);
      await page.waitForTimeout(900);
    }
    await shoot(page, path.join(dir, `${tag}-${city}.png`));
  }
}

function cityLabel(city, language) {
  if (city === 'paris') return 'Paris';
  if (city === 'nyc') return 'New York';
  return language === 'fr' ? 'Londres' : 'London';
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let n = 0;

  for (const scale of SCALES) {
    for (const vp of VIEWPORTS) {
      if (vp.scales && !vp.scales.includes(scale)) continue;
      if (ONLY && !ONLY.has(vp.name)) continue;
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: scale,
        locale: 'en-GB',            // pinned: the app falls back to navigator.language
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await installFixtures(page);
      page.on('pageerror', (e) => console.error(`  ! page error [${vp.name}]: ${e.message}`));

      for (const language of LANGUAGES) {
        await captureState(page, OUT_DIR, vp, scale, language);
        n += 4;
        process.stdout.write(`\r  captured ${n} screenshots…`);
      }
      await context.close();
    }
  }

  await browser.close();
  console.log(`\nDone: ${n} screenshots in ${OUT_DIR}`);
})();
