/**
 * The interface around the map: language and city switching, the tab bar, the
 * intro drawer and the mute button.
 *
 * All the page's copy lives in index.html, in both languages and for every
 * city. Switching simply changes which blocks are shown, which is why editing
 * the text does not mean editing any JavaScript.
 */

/**
 * Show the blocks matching the current city and language, and hide the rest.
 *
 * Every block of copy carries `data-lang`; the per-city sources carry
 * `data-city` as well and have to match both.
 */
function applyVisibility({ city, language }) {
  for (const element of document.querySelectorAll('[data-lang]')) {
    const matchesLanguage = element.dataset.lang === language;
    const matchesCity = !element.dataset.city || element.dataset.city === city;
    element.hidden = !(matchesLanguage && matchesCity);
  }
}

/**
 * Move the sliding underline to sit beneath the active tab.
 *
 * Measured with getBoundingClientRect rather than offsetLeft/offsetWidth,
 * which round to whole pixels: the tab widths are fractional, and rounding
 * them leaves the underline a fraction wider than the word above it.
 */
function positionTabInk() {
  const ink = document.querySelector('.tabs-ink');
  const active = document.querySelector('.tab.is-active');
  const list = document.querySelector('.tabs-list');
  if (!ink || !active || !list) return;

  const tab = active.getBoundingClientRect();
  const bounds = list.getBoundingClientRect();

  ink.style.left = `${tab.left - bounds.left}px`;
  ink.style.width = `${tab.width}px`;
}

function applyTabState(city) {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('is-active', tab.dataset.city === city);
    tab.setAttribute('aria-pressed', String(tab.dataset.city === city));
  }
  positionTabInk();
}

function applyLanguageState(language) {
  for (const button of document.querySelectorAll('.lang-btn')) {
    button.classList.toggle('is-inactive', button.dataset.setLanguage !== language);
  }
}

/**
 * Wire up the interface.
 *
 * @param {object} options
 * @param {() => {city: string, language: string}} options.getState
 * @param {(city: string) => void} options.onCityChange
 * @param {(language: string) => void} options.onLanguageChange
 * @param {() => void} options.onToggleMute
 * @param {() => void} options.onEnableSound
 */
export function createUi({ onCityChange, onLanguageChange, onToggleMute, onEnableSound }) {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => onCityChange(tab.dataset.city));
  }

  for (const button of document.querySelectorAll('.lang-btn')) {
    button.addEventListener('click', () => onLanguageChange(button.dataset.setLanguage));
  }

  // The tab widths change with the language and with the font, so the
  // underline has to be repositioned after both settle.
  window.addEventListener('resize', positionTabInk);
  if (document.fonts) document.fonts.ready.then(positionTabInk);

  const drawerRoot = document.getElementById('drawer-root');

  /*
   * The drawer is the site's front door and has no dismiss control of its
   * own: the only ways past it are the two buttons, which is what decides
   * whether sound is on. Neither Escape nor the backdrop closes it, matching
   * the previous build.
   */
  function closeDrawer() {
    drawerRoot.hidden = true;
    document.body.classList.remove('drawer-open');
  }

  document.getElementById('without-sound').addEventListener('click', closeDrawer);
  document.getElementById('with-sound').addEventListener('click', () => {
    closeDrawer();
    onEnableSound();
  });

  const muteButton = document.getElementById('mute');
  const muteTip = document.getElementById('mute-tip');

  function applyMuteState(muted) {
    muteButton.classList.toggle('is-muted', muted);
    // Deliberately not translated: the original label was English throughout.
    const label = muted ? 'Unmute' : 'Mute';
    muteButton.setAttribute('aria-label', label);
    muteTip.textContent = label;
  }

  // The app owns the mute state; this only reports the intent to flip it.
  muteButton.addEventListener('click', onToggleMute);

  return {
    /** Reflect the whole of the current state in the DOM. */
    render({ city, language, muted }) {
      applyVisibility({ city, language });
      applyTabState(city);
      applyLanguageState(language);
      applyMuteState(muted);
    },
    closeDrawer,
  };
}
