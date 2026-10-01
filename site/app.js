/**
 * Noisy Cities — entry point.
 *
 * Holds the small amount of state the page has (city, language, whether sound
 * is on, and the reading under the cursor) and keeps the map, gauge, tooltip,
 * audio and URL in step with it.
 */

import { createAudio } from './audio.js';
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

const audioElement = document.getElementById('noise-audio');
const audio = createAudio(audioElement);
if (typeof window !== 'undefined') window.__audio = audio; // exposed for tests
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
  audio.setVolume(volumeFor(state.value ?? 0));

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
    audio.setMuted(state.muted);
    // Unmuting is a gesture too, and may be the first one: it has to be able
    // to start the audio context for someone who dismissed the intro silently.
    if (!state.muted) audio.enable();
    update();
  },

  onEnableSound() {
    state.muted = false;
    audio.setMuted(false);
    audio.enable();
    update();
  },
});

function update() {
  /*
   * Two attributes, for two jobs.
   *
   * `lang` is the honest one: it tells a screen reader which voice to read the
   * page in and a search engine which language it has found. The previous
   * build never changed it, so French was announced in an English accent and
   * indexed as English.
   *
   * `data-language` is the stylesheet's, and has to stay separate: the city
   * tabs need a little less space between them in French, where "Londres" is
   * wider, and a rule can only match an attribute it is allowed to select on.
   */
  document.documentElement.lang = state.language;
  document.documentElement.setAttribute('data-language', state.language);

  ui.render(state);
  writeUrlState(state);
}

// --- Start ----------------------------------------------------------------

audio.setMuted(state.muted);
audio.setVolume(0);

// Always, not just for a city other than the default: on a phone the opening
// view has to be fitted to the city rather than taken from its stored zoom.
setCity(state.city);
update();
