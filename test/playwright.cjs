/**
 * Resolves Playwright for the browser-driven checks.
 *
 * Playwright is deliberately not a project dependency: the site has exactly
 * one, and adding a large test-only package back would undo the point of the
 * rewrite. So it is expected to be installed globally, and this looks there
 * as well as in the usual places.
 */

const { execSync } = require('child_process');

function resolvePlaywright() {
  try {
    return require('playwright');
  } catch {
    // Not local; fall through to the global install.
  }

  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return require(require.resolve('playwright', { paths: [globalRoot] }));
  } catch {
    console.error(
      'This check needs Playwright, which was not found.\n\n'
      + '  npm install -g playwright\n'
      + '  npx playwright install chromium\n\n'
      + 'It is deliberately not a project dependency — the site itself has only one.'
    );
    process.exit(1);
  }
}

module.exports = resolvePlaywright();
