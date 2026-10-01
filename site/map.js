/**
 * The Mapbox map, and the colour sampling that drives the tooltip, gauge and
 * audio.
 *
 * The map is deliberately plain Mapbox GL. The previous build wrapped it in
 * deck.gl purely to receive pointer events and clamp panning -- it drew no
 * layers of its own -- and in react-map-gl, which the code then reached
 * straight through with `mapRef.getMap()` to do the real work. Mapbox
 * provides all of it directly.
 */

const ACCESS_TOKEN =
  'pk.eyJ1IjoicGZjcm91c3NlIiwiYSI6ImNreWtycmJxOTI0dWUzMHFwOTNtdjk1OGUifQ.vaI6qrvOwkqWe5k8JhNYdg';
const STYLE = 'mapbox://styles/pfcrousse/ckymrthcs8bs614qpadigs2os';

/**
 * Where each city sits, how far out you may zoom, and the box you may pan
 * within. Bounds are [[west, south], [east, north]].
 */
export const CITIES = {
  paris: {
    longitude: 2.395,
    latitude: 48.851,
    zoom: 10.2,
    bbox: [[2.0943827204, 48.7117011393], [2.6588734805, 49.035891562]],
  },
  london: {
    longitude: -0.048,
    latitude: 51.491,
    zoom: 10,
    bbox: [[-0.5945770815, 51.2468407724], [0.3375120088, 51.7292587128]],
  },
  nyc: {
    longitude: -73.917,
    latitude: 40.710,
    zoom: 10,
    bbox: [[-74.2740753571, 40.4853136705], [-73.8192439591, 40.8276099713]],
  },
};

export const DEFAULT_CITY = 'paris';

/** The width below which the layout stacks and the map becomes a phone map. */
const MOBILE_QUERY = '(max-width: 899.98px)';

/** Breathing room around the city when the whole of it is fitted on screen. */
const MOBILE_PADDING = 12;

/**
 * Read the colour of a single pixel out of the map's WebGL buffer.
 *
 * This is why the map is created with `preserveDrawingBuffer`: without it the
 * buffer is cleared after each frame and this reads back blank.
 *
 * @returns {Uint8Array|null} RGBA bytes, or null if there is no GL context.
 */
function readPixel(map, point) {
  const canvas = map.getCanvas();
  const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
  if (!gl) return null;

  const data = new Uint8Array(4);
  const ratio = window.devicePixelRatio;

  // The GL buffer is in device pixels with its origin at the bottom left;
  // pointer coordinates are in CSS pixels from the top left.
  gl.readPixels(
    point.x * ratio,
    canvas.height - point.y * ratio,
    1, 1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data
  );

  return data;
}

/**
 * Create the map.
 *
 * @param {HTMLElement} container
 * @param {object} handlers
 * @param {(reading: {x: number, y: number, rgba: Uint8Array}) => void} handlers.onSample
 *   Called at most once per frame while the pointer is over the map.
 * @param {() => void} handlers.onLeave Pointer left the map, or a drag began.
 * @returns {{ setCity: (city: string) => void, map: object }}
 */
export function createMap(container, { onSample, onLeave }) {
  const start = CITIES[DEFAULT_CITY];

  const map = new mapboxgl.Map({
    container,
    style: STYLE,
    accessToken: ACCESS_TOKEN,
    center: [start.longitude, start.latitude],
    zoom: start.zoom,
    pitch: 0,
    bearing: 0,
    minZoom: start.zoom,
    // Required by readPixel above.
    preserveDrawingBuffer: true,
  });

  if (typeof window !== 'undefined') window.__map = map; // exposed for tests
  map.getCanvas().style.cursor = 'crosshair';

  let currentCity = DEFAULT_CITY;

  /*
   * Phones behave differently enough to be worth stating plainly.
   *
   * On a narrow screen the per-city zoom was chosen for a wide desktop pane,
   * so it lands halfway into the city with no way to see the rest: you could
   * pan, but panning to find the loud parts is a poor way to meet a map whose
   * whole point is sweeping across it. So on a phone the view is fitted to the
   * entire city and locked there, dragging no longer pans, and moving a finger
   * over the map reads it the way a mouse does on a desktop.
   *
   * The boundary is the same one the layout already uses, so a narrow desktop
   * window behaves like a phone. That is deliberate: it keys off the space
   * available rather than sniffing at the device.
   */
  const phone = window.matchMedia(MOBILE_QUERY);
  let navigation = null;

  /*
   * Keep the map's centre inside the city's box.
   *
   * Mapbox's own maxBounds would be the obvious tool, but it constrains the
   * whole viewport rather than the centre: it zooms in until the box fills the
   * window, which overrides the framing each city was given. Paris rendered at
   * zoom 10.4 instead of 10.2 on a wide screen, and further out still on a
   * larger one.
   *
   * Clamping the centre is what the previous build did. The view may extend
   * past the box near its edges, which is the point -- the box says where you
   * may look from, not what may be on screen.
   */
  let clamping = false;

  function clampCentre() {
    if (clamping) return;

    const [[west, south], [east, north]] = CITIES[currentCity].bbox;
    const centre = map.getCenter();
    const lng = Math.min(east, Math.max(west, centre.lng));
    const lat = Math.min(north, Math.max(south, centre.lat));
    if (lng === centre.lng && lat === centre.lat) return;

    // setCenter fires another move; the flag stops it recursing.
    clamping = true;
    map.setCenter([lng, lat]);
    clamping = false;
  }

  map.on('move', clampCentre);

  /** Turn the panning and zooming gestures on or off to suit the screen. */
  function applyInteraction() {
    if (phone.matches) {
      // The view is fixed, so every gesture that would move it is off. What is
      // left is a finger reading the map.
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      map.doubleClickZoom.disable();
      map.dragRotate.disable();
      if (map.touchPitch) map.touchPitch.disable();

      // Nothing for the zoom buttons to do once the view is locked.
      if (navigation) {
        map.removeControl(navigation);
        navigation = null;
      }
      return;
    }

    map.dragPan.enable();
    map.scrollZoom.enable();
    map.touchZoomRotate.enable();
    map.doubleClickZoom.enable();
    map.dragRotate.enable();

    if (!navigation) {
      navigation = new mapboxgl.NavigationControl();
      map.addControl(navigation, 'top-left');
    }
  }

  /**
   * Put a city on screen.
   *
   * On a desktop that means the centre and zoom the city was given. On a phone
   * it means the whole of its box, at whatever zoom that takes, with the zoom
   * pinned there so the view cannot drift.
   */
  function frameCity(name) {
    const city = CITIES[name];
    if (!city) return;

    // Lifted first: a stale floor or ceiling from the previous city would
    // fight the move.
    map.setMinZoom(null);
    map.setMaxZoom(null);

    if (phone.matches) {
      map.fitBounds(city.bbox, { padding: MOBILE_PADDING, animate: false, bearing: 0, pitch: 0 });
      const fitted = map.getZoom();
      map.setMinZoom(fitted);
      map.setMaxZoom(fitted);
      return;
    }

    /*
     * Clear any padding the phone fit left behind. It is camera padding, not a
     * one-off argument, so it persists: a window dragged wider than the
     * breakpoint would otherwise keep rendering the desktop view offset by
     * half of it, which getCenter() does not reveal because it reports the
     * camera rather than what is drawn.
     */
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.jumpTo({
      center: [city.longitude, city.latitude],
      zoom: city.zoom,
      pitch: 0,
      bearing: 0,
    });
    map.setMinZoom(city.zoom);
  }

  /*
   * Pointer moves can arrive faster than the screen repaints, and each one
   * costs a synchronous GL read. Keep only the latest and sample it once per
   * frame. (React used to absorb this by batching its state updates.)
   */
  let pendingPoint = null;
  let frame = 0;

  function sampleLatest() {
    frame = 0;
    const point = pendingPoint;
    pendingPoint = null;
    if (!point) return;

    const rgba = readPixel(map, point);
    if (rgba) onSample({ x: point.x, y: point.y, rgba });
  }

  map.on('mousemove', (event) => {
    pendingPoint = event.point;
    if (!frame) frame = requestAnimationFrame(sampleLatest);
  });

  map.on('mouseout', () => {
    pendingPoint = null;
    onLeave();
  });

  /*
   * Reading the map with a finger. Only on a phone: where the map can still be
   * panned, a drag has to stay a drag.
   *
   * The map's own container sets touch-action to none at this width, without
   * which the browser would scroll the page out from under the finger rather
   * than let it sweep across the city.
   */
  function scrub(event) {
    if (!phone.matches) return;
    pendingPoint = event.point;
    if (!frame) frame = requestAnimationFrame(sampleLatest);
  }

  map.on('touchstart', scrub);
  map.on('touchmove', scrub);

  for (const ending of ['touchend', 'touchcancel']) {
    map.on(ending, () => {
      if (!phone.matches) return;
      pendingPoint = null;
      onLeave();
    });
  }

  // Hide the readout while dragging, as the previous build did.
  map.on('dragstart', () => {
    pendingPoint = null;
    onLeave();
  });

  /** Move to a city, and clamp to that city's box from then on. */
  function setCity(name) {
    if (!CITIES[name]) return;

    // Set first, so the move is not dragged back towards the old city's box.
    currentCity = name;
    frameCity(name);
  }

  /*
   * A phone's fitted zoom depends on the size of the map, so turning the
   * handset has to re-fit it. Coalesced to a frame: resize fires in bursts.
   */
  let refit = 0;
  window.addEventListener('resize', () => {
    if (!phone.matches || refit) return;
    refit = requestAnimationFrame(() => {
      refit = 0;
      frameCity(currentCity);
    });
  });

  // Crossing the breakpoint swaps both the gestures and the framing.
  phone.addEventListener('change', () => {
    applyInteraction();
    frameCity(currentCity);
  });

  applyInteraction();
  frameCity(currentCity);

  return { map, setCity };
}
