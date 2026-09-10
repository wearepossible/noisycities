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
  if (typeof window !== 'undefined') window.__map = map; // exposed for tests
  map.addControl(new mapboxgl.NavigationControl(), 'top-left');
  map.getCanvas().style.cursor = 'crosshair';

  let currentCity = DEFAULT_CITY;

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

  // Hide the readout while dragging, as the previous build did.
  map.on('dragstart', () => {
    pendingPoint = null;
    onLeave();
  });

  /** Move to a city, and clamp to that city's box from then on. */
  function setCity(name) {
    const city = CITIES[name];
    if (!city) return;

    // Set first, so the jump is not dragged back towards the old city's box.
    currentCity = name;

    // Lifted while jumping: the new centre is outside the old minimum zoom's
    // city, and a stale floor would fight the move.
    map.setMinZoom(null);
    map.jumpTo({
      center: [city.longitude, city.latitude],
      zoom: city.zoom,
      pitch: 0,
      bearing: 0,
    });
    map.setMinZoom(city.zoom);
  }

  return { map, setCity };
}
