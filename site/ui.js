/**
 * The interface around the map: language and city switching, the tab bar, the
 * share links, the intro drawer and the mute button.
 *
 * All the page's copy lives in index.html, in both languages and for every
 * city. Switching simply changes which blocks are shown, which is why editing
 * the text does not mean editing any JavaScript.
 */

const SHARE_URL = 'https://www.carfreemegacities.org/noise-pollution';

const SHARE_TEXT = {
  en:
    `Noise pollution is one of the biggest threats to environmental health in Europe. \n`
    + `Don't cover your ears. Find out just how noisy our cities are with this new interactive map 👇`,
  fr:
    `La pollution sonore est l'une des plus grandes menaces pour la santé environnementale en Europe.\n`
    + `Ne couvrez pas vos oreilles. Découvrez à quel point nos villes sont bruyantes grâce à cette carte interactive 👇`,
};

/**
 * Brand marks, copied from react-share (MIT licensed) so the buttons look
 * exactly as they did. Each is a filled circle with a white glyph on top.
 */
const SHARE_ICONS = {
  twitter: {
    color: '#00aced',
    path: 'M48,22.1c-1.2,0.5-2.4,0.9-3.8,1c1.4-0.8,2.4-2.1,2.9-3.6c-1.3,0.8-2.7,1.3-4.2,1.6 C41.7,19.8,40,19,38.2,19c-3.6,0-6.6,2.9-6.6,6.6c0,0.5,0.1,1,0.2,1.5c-5.5-0.3-10.3-2.9-13.5-6.9c-0.6,1-0.9,2.1-0.9,3.3 c0,2.3,1.2,4.3,2.9,5.5c-1.1,0-2.1-0.3-3-0.8c0,0,0,0.1,0,0.1c0,3.2,2.3,5.8,5.3,6.4c-0.6,0.1-1.1,0.2-1.7,0.2c-0.4,0-0.8,0-1.2-0.1 c0.8,2.6,3.3,4.5,6.1,4.6c-2.2,1.8-5.1,2.8-8.2,2.8c-0.5,0-1.1,0-1.6-0.1c2.9,1.9,6.4,2.9,10.1,2.9c12.1,0,18.7-10,18.7-18.7 c0-0.3,0-0.6,0-0.8C46,24.5,47.1,23.4,48,22.1z',
  },
  facebook: {
    color: '#0866FF',
    path: 'M34.1,47V33.3h4.6l0.7-5.3h-5.3v-3.4c0-1.5,0.4-2.6,2.6-2.6l2.8,0v-4.8c-0.5-0.1-2.2-0.2-4.1-0.2 c-4.1,0-6.9,2.5-6.9,7V28H24v5.3h4.6V47H34.1z',
  },
  linkedin: {
    color: '#0077B5',
    path: 'M20.4,44h5.4V26.6h-5.4V44z M23.1,18c-1.7,0-3.1,1.4-3.1,3.1c0,1.7,1.4,3.1,3.1,3.1 c1.7,0,3.1-1.4,3.1-3.1C26.2,19.4,24.8,18,23.1,18z M39.5,26.2c-2.6,0-4.4,1.4-5.1,2.8h-0.1v-2.4h-5.2V44h5.4v-8.6 c0-2.3,0.4-4.5,3.2-4.5c2.8,0,2.8,2.6,2.8,4.6V44H46v-9.5C46,29.8,45,26.2,39.5,26.2z',
  },
};

const SHARE_ICON_SIZE = 32;

/**
 * The share destinations, reproducing exactly what react-share generated --
 * including that Facebook's sharer only ever reads the URL, so the quote that
 * used to be passed alongside it never reached Facebook at all.
 */
const SHARE_LINKS = {
  twitter: (language) => withParams('https://twitter.com/intent/tweet', {
    url: SHARE_URL,
    text: `${SHARE_TEXT[language]} via @_wearepossible`,
  }),
  facebook: () => withParams('https://www.facebook.com/sharer/sharer.php', {
    u: SHARE_URL,
  }),
  linkedin: (language) => withParams('https://linkedin.com/shareArticle', {
    url: SHARE_URL,
    mini: 'true',
    title: `${SHARE_TEXT[language]} via https://www.linkedin.com/company/wearepossible/`,
  }),
};

function withParams(base, params) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${base}?${query}` : base;
}

/** Fill in the share links' icons once; their targets are set per language. */
export function renderShareLinks() {
  for (const link of document.querySelectorAll('.share')) {
    const { color, path } = SHARE_ICONS[link.dataset.share];
    link.innerHTML =
      `<svg viewBox="0 0 64 64" width="${SHARE_ICON_SIZE}" height="${SHARE_ICON_SIZE}">`
      + `<circle cx="32" cy="32" r="32" fill="${color}"></circle>`
      + `<path d="${path}" fill="white"></path>`
      + '</svg>';
  }
}

function updateShareTargets(language) {
  for (const link of document.querySelectorAll('.share')) {
    link.href = SHARE_LINKS[link.dataset.share](language);
  }
}

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
  renderShareLinks();

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
      updateShareTargets(language);
      applyMuteState(muted);
    },
    closeDrawer,
  };
}
