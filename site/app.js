/**
 * Noisy Cities — entry point.
 *
 * Holds the small amount of state the page has (city, language, whether sound
 * is on, and the reading under the cursor) and keeps the map, gauge, tooltip,
 * audio and URL in step with it.
 */

import { nearestStepValue, volumeFor } from './colours.js';
import { createGauge } from './gauge.js';
import { createMap, CITIES, DEFAULT_CITY } from './map.js';
import { createUi } from './ui.js';

const LANGUAGES = ['en', 'fr'];

// Hand control of the language and city blocks over from the CSS fallback.
document.documentElement.classList.remove('no-js');

// --- URL ------------------------------------------------------------------
// The address keeps the shape it has always had -- "#/?city=…&language=…" --
// so links people have already shared keep working.

function readUrlState() {
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query);
}

/**
 * Mirror the state into the address bar.
 *
 * `replaceState` rather than a push, matching the previous router call: the
 * back button never stepped through cities, and it still doesn't.
 */
function writeUrlState({ city, language }) {
  window.history.replaceState(null, '', `#/?city=${city}&language=${language}`);
}

/** The browser's language, unless the URL says otherwise. */
function initialLanguage(url) {
  const requested = url.get('language');
  if (LANGUAGES.includes(requested)) return requested;

  const preferred = navigator.language || navigator.userLanguage;
  return preferred && preferred.startsWith('fr') ? 'fr' : 'en';
}

// --- State ----------------------------------------------------------------

const url = readUrlState();

const state = {
  city: CITIES[url.get('city')] ? url.get('city') : DEFAULT_CITY,
  language: initialLanguage(url),
  muted: true,
  value: null,
};

// --- Elements -------------------------------------------------------------

const audio = document.getElementById('noise-audio');
const tooltip = document.getElementById('tooltip');
const swatch = tooltip.querySelector('.tooltip-swatch');

const gauge = createGauge(document.getElementById('gauge'));

/** Show the colour under the cursor, following it around the map. */
function showTooltip(x, y, color) {
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  swatch.style.backgroundColor = color;
  tooltip.hidden = false;
}

function hideTooltip() {
  tooltip.hidden = true;
}

/**
 * Apply a reading: the gauge needle, the audio volume and the swatch all
 * follow from it. A null reading means the pointer is off the map.
 */
function setReading(reading) {
  state.value = reading ? reading.value : null;

  gauge.setValue(state.value);
  audio.volume = volumeFor(state.value ?? 0);

  if (reading) {
    showTooltip(reading.x, reading.y, reading.color);
  } else {
    hideTooltip();
  }
}

// --- Map ------------------------------------------------------------------

const { setCity } = createMap(document.getElementById('map'), {
  onSample({ x, y, rgba }) {
    const [r, g, b, a] = rgba;
    setReading({
      x,
      y,
      value: nearestStepValue(r, g, b),
      color: `rgba(${r}, ${g}, ${b}, ${a})`,
    });
  },
  onLeave() {
    setReading(null);
  },
});

// --- Interface ------------------------------------------------------------

const ui = createUi({
  onCityChange(city) {
    if (city === state.city) return;
    state.city = city;
    setCity(city);
    update();
  },

  onLanguageChange(language) {
    if (language === state.language) return;
    state.language = language;
    update();
  },

  onToggleMute() {
    state.muted = !state.muted;
    audio.muted = state.muted;
    update();
  },

  onEnableSound() {
    state.muted = false;
    audio.muted = false;
    // Autoplay with sound needs a gesture; this runs inside the button's click.
    audio.play().catch(() => {
      /* Blocked by the browser: the mute button remains available. */
    });
    update();
  },
});

function update() {
  /*
   * The stylesheet needs the current language: the city tabs need a little
   * less space between them in French, where "Londres" is wider.
   *
   * Note this is deliberately NOT the `lang` attribute, which would be the
   * accessible thing to set -- the document still claims English while showing
   * French, as it always has. Setting it correctly changes how the browser
   * renders French text, which would break the pixel-for-pixel match this
   * rewrite is held to. Worth doing as its own change.
   */
  document.documentElement.setAttribute('data-language', state.language);

  ui.render(state);
  writeUrlState(state);
}

// --- Start ----------------------------------------------------------------

audio.muted = state.muted;
audio.volume = 0;

if (state.city !== DEFAULT_CITY) setCity(state.city);
update();
