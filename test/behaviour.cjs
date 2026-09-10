/**
 * Behavioural checks that screenshots cannot make: the URL contract, language
 * and city switching, the drawer's two exits, and the mute control.
 *
 * The map is blocked here deliberately -- none of this depends on tiles, and
 * the sampling path has its own test in hover-pipeline.cjs.
 *
 * Usage: NODE_PATH=/opt/node22/lib/node_modules node test/behaviour.cjs [baseUrl]
 */

const { chromium } = require('playwright');
const { installFixtures } = require('./fixtures.cjs');

const BASE_URL = process.argv[2] || 'http://localhost:8080';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `\n         ${detail}`}`);
};

const visibleText = (page, selector) =>
  page.locator(`${selector}:visible`).allInnerTexts().then((t) => t.join(' '));

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' });
  const page = await context.newPage();
  await installFixtures(page);

  // --- Deep links -----------------------------------------------------------
  await page.goto(`${BASE_URL}/#/?city=nyc&language=fr`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // The drawer is modal and blocks the page beneath it, so it has to go first.
  await page.getByRole('button', { name: /without sound/i }).click();
  await page.waitForTimeout(300);

  check('deep link selects the city',
    (await page.locator('.tab.is-active').innerText()) === 'New York');

  const frenchSources = await visibleText(page, '.panel-sources > [data-city]');
  check('deep link selects the language',
    frenchSources.includes('US DOT') && frenchSources.includes('décibels'),
    `visible sources began: ${frenchSources.slice(0, 60)}`);

  check('only one city\'s sources are visible',
    (await page.locator('.panel-sources > [data-city]:visible').count()) === 1);

  // --- Switching ------------------------------------------------------------
  const historyBefore = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Paris', exact: true }).click();
  await page.waitForTimeout(600);

  check('switching city updates the URL',
    page.url().endsWith('#/?city=paris&language=fr'), page.url());

  check('switching city adds no history entry',
    (await page.evaluate(() => history.length)) === historyBefore);

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.waitForTimeout(600);

  check('switching language updates the URL',
    page.url().endsWith('#/?city=paris&language=en'), page.url());

  const englishSources = await visibleText(page, '.panel-sources > [data-city]');
  check('switching language swaps the copy',
    englishSources.includes('Remember: decibels') && !englishSources.includes('décibels'));

  check('the London tab is labelled per language',
    (await page.getByRole('button', { name: 'London', exact: true }).count()) === 1);

  // --- Share links ----------------------------------------------------------
  const shareHrefs = await page.locator('.share:visible').evaluateAll((links) =>
    links.map((a) => a.href));
  check('three share links, each to the right network',
    shareHrefs.length === 3
      && shareHrefs[0].startsWith('https://twitter.com/intent/tweet?url=')
      && shareHrefs[1].startsWith('https://www.facebook.com/sharer/sharer.php?u=')
      && shareHrefs[2].startsWith('https://linkedin.com/shareArticle?url='),
    shareHrefs.join('\n         '));

  check('share text follows the language',
    decodeURIComponent(shareHrefs[0]).includes('Noise pollution is one of the biggest threats'));

  await page.getByRole('button', { name: 'FR', exact: true }).click();
  await page.waitForTimeout(400);
  const frShare = await page.locator('.share:visible').first().getAttribute('href');
  check('share text follows the language when switched',
    decodeURIComponent(frShare).includes('La pollution sonore'));

  // --- The drawer -----------------------------------------------------------
  await page.goto('about:blank');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  check('drawer is open on arrival', await page.locator('#drawer-root').isVisible());

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('escape does not dismiss the drawer', await page.locator('#drawer-root').isVisible());

  await page.locator('.drawer-mask').click({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(300);
  check('clicking the backdrop does not dismiss the drawer',
    await page.locator('#drawer-root').isVisible());

  await page.getByRole('button', { name: /without sound/i }).click();
  await page.waitForTimeout(300);
  check('"Without sound" dismisses the drawer',
    !(await page.locator('#drawer-root').isVisible()));
  check('"Without sound" leaves the audio muted',
    await page.evaluate(() => document.getElementById('noise-audio').muted));
  check('dismissing the drawer releases the page scroll',
    !(await page.evaluate(() => document.body.classList.contains('drawer-open'))));

  // --- Mute -----------------------------------------------------------------
  await page.locator('#mute').click();
  await page.waitForTimeout(200);
  check('mute button unmutes',
    (await page.evaluate(() => document.getElementById('noise-audio').muted)) === false);
  check('mute button relabels itself',
    (await page.locator('#mute').getAttribute('aria-label')) === 'Mute');

  await page.locator('#mute').click();
  await page.waitForTimeout(200);
  check('mute button mutes again',
    (await page.evaluate(() => document.getElementById('noise-audio').muted)) === true);

  // --- "With sound" ---------------------------------------------------------
  await page.goto('about:blank');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /with sound/i }).click();
  await page.waitForTimeout(800);
  const audio = await page.evaluate(() => {
    const a = document.getElementById('noise-audio');
    return { muted: a.muted, paused: a.paused, loop: a.loop, t: a.currentTime };
  });
  check('"With sound" unmutes and starts playback',
    audio.muted === false && audio.paused === false && audio.loop === true,
    JSON.stringify(audio));

  // Playback must survive switching city and language: the element sits outside
  // anything that is rebuilt, so the loop should keep running from where it was.
  const before = await page.evaluate(() => document.getElementById('noise-audio').currentTime);
  await page.getByRole('button', { name: 'New York', exact: true }).click();
  await page.getByRole('button', { name: 'FR', exact: true }).click();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const a = document.getElementById('noise-audio');
    return { t: a.currentTime, paused: a.paused, muted: a.muted };
  });
  check('audio keeps playing across a city and language change',
    after.paused === false && after.muted === false && after.t >= before,
    `before ${before}, after ${JSON.stringify(after)}`);

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\nFAIL — ${failed.length} of ${results.length} checks failed.`);
    process.exit(1);
  }
  console.log(`\nPASS — all ${results.length} behavioural checks.`);
})();
