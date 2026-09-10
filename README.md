# noisycities

Noise pollution maps for London, Paris and New York.

Hover the map and the colour under your cursor is matched to a decibel
reading, which moves the gauge and sets how loud the city sounds.

## One dependency, on purpose

The only thing this site depends on is [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/),
which draws the map. Everything else — the layout, the gauge, the tabs, the
sharing links, the audio — is plain HTML, CSS and JavaScript, with no build
step and nothing to compile.

That is a deliberate choice, not an oversight. The site is finished. It gets
occasional copy edits and nothing more, so the thing worth optimising for is
that it still works in ten years with nobody maintaining it. Build toolchains
are what rot: a bundler pinned to a particular Node version tends to stop
working long before any HTML does, and it usually fails at the worst moment,
when someone makes a one-word change and discovers the site will not publish.

It previously depended on 563 packages, and Dependabot raised pull requests
against them every week.

**Please don't add a framework or a build step to make a small change.** If you
find yourself wanting one, the change probably belongs in `site/index.html`
instead.

## Layout

```
site/          the site itself, published exactly as written
  index.html   page structure and all of the copy, in both languages
  styles.css
  app.js       entry point: holds the state, wires everything together
  map.js       Mapbox setup and the pixel sampling behind the readings
  gauge.js     the decibel dial
  steps.js     the decibel scale — colours and labels live here
  colours.js   matching a pixel to a reading, and a reading to a volume
  ui.js        tabs, language switch, share links, drawer, mute
  assets/      audio and logos
test/          comparison harness (see below)
build/         generated; not in version control
```

### Editing the copy

All of it is in `site/index.html` as ordinary markup. Each block is tagged
with `data-lang` for the language, and the per-city sources with `data-city`
as well. Nothing else needs touching.

### Changing the colour scale

`site/steps.js` is the single source of truth. The gauge builds its segments
from it and the colour matcher builds its palette from it, so a colour changed
there changes everywhere.

## Running it

```sh
npm install     # fetches Mapbox
npm run dev     # builds, then serves at http://localhost:8000
```

`npm run dev` serves with Python's built-in web server. Any static server will
do — the files need to be served over HTTP rather than opened directly,
because browsers refuse to load JavaScript modules from a bare file path.

```sh
npm run build   # assembles build/ for publishing
```

The build copies `site/` and drops Mapbox's two distributed files into
`build/vendor/`. That is the whole of it; `build.sh` is six lines.

## Deployment

Netlify, configured in `netlify.toml`. Opening a pull request produces a
deploy preview.

## Keeping it safe

Mapbox is the entire supply chain, so it is worth having its security updates.
Dependabot's routine version updates are switched off deliberately — a
finished site gains nothing from being bumped to the latest of everything —
but **Dependabot security updates should stay enabled** in the repository
settings, under Settings → Code security. Watching
[mapbox-gl-js releases](https://github.com/mapbox/mapbox-gl-js/releases) is
worthwhile too.

## The comparison harness

`test/` holds the tooling used to check the rewrite against the React build it
replaced.

```sh
npm test          # gauge geometry, and the colour and volume parity check
```

Those two need nothing but Node. The rest drive a browser, so they need
Playwright — which is deliberately *not* a project dependency; install it
globally — and a running site:

```sh
npm run dev &                            # serves on :8000
npm run test:browser                     # behaviour, and the hover pipeline
node test/capture.cjs  <url> <dir>       # screenshot a site across viewports
node test/compare.cjs  <dirA> <dirB>     # compare two sets, pixel for pixel
```

`test/colour-parity.cjs` compares against the libraries this replaced, so it
reports a skip now that they are uninstalled; it passed across 140,699 samples
at the time of the rewrite. `test/hover-pipeline.cjs` serves Mapbox a flat
one-colour style so the real WebGL sampling path can be checked without
depending on tiles or the network.

`test/fixtures/gauge-original.svg` is the gauge as the previous build actually
rendered it, kept as the reference. `test/fixtures/fonts/` is a local copy of
the Google Fonts the page uses, so screenshot runs do not depend on the
network.

These exist to prove the rewrite; none of them is needed to run or deploy the
site, and they can be deleted if they ever become a burden.
