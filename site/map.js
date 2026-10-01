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
 * Where each city sits, how far out you may zoom, and two boxes.
 *
 * `bbox` is the box the map's centre is kept inside while panning on a
 * desktop. It is not the extent of the data and never was -- it is a little
 * arbitrary, and it is left exactly as it has always been so desktop panning
 * is unchanged.
 *
 * `data` is where the noise actually is, and a phone fits the whole of it.
 * These are measured rather than declared: each city's raster tileset was
 * downloaded at zoom 10 -- about 150m a pixel -- and scanned for the
 * outermost pixel carrying any ink at all. The bounds Mapbox reports for a
 * tileset are the extent of the image it was cut from, and for New York that
 * is a canvas nearly twice the size of the city. Fitting those zoomed out
 * 1.75x too far, and showed a faint band of texture along the top where the
 * empty margin ends, well north of anything painted. Paris's reported bounds
 * happened to match its ink; London's were about a tenth too generous.
 *
 * Both are [[west, south], [east, north]].
 */
export const CITIES = {
  paris: {
    longitude: 2.395,
    latitude: 48.851,
    zoom: 10.2,
    bbox: [[2.0943827204, 48.7117011393], [2.6588734805, 49.035891562]],
    data: [[2.145081, 48.645613], [2.616119, 49.012654]],
  },
  london: {
    longitude: -0.048,
    latitude: 51.491,
    zoom: 10,
    bbox: [[-0.5945770815, 51.2468407724], [0.3375120088, 51.7292587128]],
    data: [[-0.510864, 51.289406], [0.307617, 51.692990]],
  },
  nyc: {
    longitude: -73.917,
    latitude: 40.710,
    zoom: 10,
    bbox: [[-74.2740753571, 40.4853136705], [-73.8192439591, 40.8276099713]],
    data: [[-74.256592, 40.496048], [-73.700409, 40.915588]],
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
    // Added by hand below, so that it can change corner. See placeAttribution.
    attributionControl: false,
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
   * entire city and pinned there, a finger dragged across it reads it the way
   * a mouse does on a desktop, and moving the map is left to two fingers.
   *
   * The boundary is the same one the layout already uses, so a narrow desktop
   * window behaves like a phone. That is deliberate: it keys off the space
   * available rather than sniffing at the device.
   */
  const phone = window.matchMedia(MOBILE_QUERY);
  let navigation = null;

  /*
   * Mapbox pins its credit control to the bottom right, which is where the
   * dial sits on a phone, and draws it above the dial. So on a phone it moves
   * to the bottom left, beside the Mapbox wordmark that is already there --
   * Mapbox lays the two out side by side itself. Switching the map's own
   * control off at construction is the only way to get hold of it; its corner
   * is otherwise fixed for the life of the map.
   */
  const attribution = new mapboxgl.AttributionControl();
  let attributionCorner = null;

  function placeAttribution(corner) {
    if (attributionCorner === corner) return;
    if (attributionCorner) map.removeControl(attribution);
    map.addControl(attribution, corner);
    attributionCorner = corner;
  }

  /*
   * Keep the view inside the city.
   *
   * A desktop keeps the map's *centre* inside the city's panning box. Mapbox's
   * own maxBounds would be the obvious tool, but it constrains the whole
   * viewport rather than the centre: it zooms in until the box fills the
   * window, which overrides the framing each city was given. Paris rendered at
   * zoom 10.4 instead of 10.2 on a wide screen, and further out still on a
   * larger one. Clamping the centre is what the previous build did. The view
   * may extend past the box near its edges, which is the point -- the box says
   * where you may look from, not what may be on screen.
   *
   * A phone keeps the whole *view* inside the city's data instead. A
   * centre-only clamp was harmless while nothing on a phone could pan, but two
   * fingers can now, and the centre is free to roam a box half the city wide
   * -- enough to drag the city most of the way off the screen. Where the view
   * is larger than the city on an axis, which it always is at the zoom where
   * all of it fits, the city is centred on that axis rather than clamped. That
   * is what holds it in the middle of the frame.
   */
  let clamping = false;

  /**
   * Hold `value` so that it keeps `before` ahead of `lo` and `after` behind
   * `hi`. Too big a span to fit between them means sitting in the middle, with
   * the overflow shared equally either side.
   */
  function fit(value, before, after, lo, hi) {
    const low = lo + before;
    const high = hi - after;
    if (low > high) return (low + high) / 2;
    return Math.min(high, Math.max(low, value));
  }

  /** Web Mercator y for a latitude. It grows southwards, unlike the latitude. */
  function mercatorY(lat) {
    return mapboxgl.MercatorCoordinate.fromLngLat([0, lat]).y;
  }

  function clampView() {
    if (clamping) return;

    const city = CITIES[currentCity];
    const centre = map.getCenter();

    if (!phone.matches) {
      const [[west, south], [east, north]] = city.bbox;
      const lng = Math.min(east, Math.max(west, centre.lng));
      const lat = Math.min(north, Math.max(south, centre.lat));
      if (lng === centre.lng && lat === centre.lat) return;

      // setCenter fires another move; the flag stops it recursing.
      clamping = true;
      map.setCenter([lng, lat]);
      clamping = false;
      return;
    }

    const view = map.getBounds();
    if (!view) return;
    const [[west, south], [east, north]] = city.data;

    // Longitude is linear in web Mercator, so degrees clamp directly.
    const lng = fit(
      centre.lng,
      centre.lng - view.getWest(),
      view.getEast() - centre.lng,
      west,
      east
    );

    // Latitude is not, so it is clamped in Mercator y. North is the smaller
    // number there, which is why the city's edges go in the other way round.
    const y = mercatorY(centre.lat);
    const clampedY = fit(
      y,
      y - mercatorY(view.getNorth()),
      mercatorY(view.getSouth()) - y,
      mercatorY(north),
      mercatorY(south)
    );

    // fit() returns its input untouched when nothing needs moving, so these
    // compare exactly rather than within a tolerance.
    if (lng === centre.lng && clampedY === y) return;

    clamping = true;
    map.setCenter([lng, new mapboxgl.MercatorCoordinate(0, clampedY).toLngLat().lat]);
    clamping = false;
  }

  map.on('move', clampView);

  /** Set the panning and zooming gestures, and the controls, to suit the screen. */
  function applyInteraction() {
    if (phone.matches) {
      /*
       * One finger reads the map rather than moving it, so a one-finger pan is
       * off. Two fingers still pan: a pinch that zooms without the map
       * following the fingers feels broken, and zooming in is how you pick out
       * a single street.
       *
       * Both of those come from Mapbox's cooperative gestures, which is its
       * switch for exactly this -- the touch-pan handler drops a one-finger
       * pan while it is set and keeps a two-finger one. Drag-pan has to be
       * enabled for either to happen, and enabling it matters for a second
       * reason: Mapbox sets the canvas's touch-action from which handlers are
       * on, and with pinch alone it hands drags to the browser to scroll the
       * page with. (The stylesheet puts that back, for the one case Mapbox
       * then gets wrong. See styles.css.)
       *
       * Rotation goes too -- a tilted north serves nothing here -- and so does
       * double-tap, which would otherwise fire when someone taps twice in
       * quick succession while reading the map.
       */

      /*
       * Scroll zoom goes first, before the flag. Disabling it while
       * cooperative gestures are set reaches for an alert element that only
       * exists if they were set back when it was enabled, and throws when it
       * is not there.
       */
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
      map.dragRotate.disable();
      if (map.touchPitch) map.touchPitch.disable();

      map.setCooperativeGestures(true);
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.touchZoomRotate.disableRotation();

      // Pinch covers zooming on a touchscreen; the buttons are just clutter.
      if (navigation) {
        map.removeControl(navigation);
        navigation = null;
      }

      placeAttribution('bottom-left');
      return;
    }

    /*
     * Drag-pan goes first here, while the flag is still set: disabling it is
     * what takes the one-finger blocker and its two classes back off the
     * canvas, and it only does that while cooperative gestures are on.
     */
    map.dragPan.disable();
    map.setCooperativeGestures(false);

    map.dragPan.enable();
    map.scrollZoom.enable();
    map.touchZoomRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.doubleClickZoom.enable();
    map.dragRotate.enable();
    if (map.touchPitch) map.touchPitch.enable();

    if (!navigation) {
      navigation = new mapboxgl.NavigationControl();
      map.addControl(navigation, 'top-left');
    }

    placeAttribution('bottom-right');
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
      // The data, not the panning box: the city should sit centred in the
      // frame and reach its edges.
      map.fitBounds(city.data, { padding: MOBILE_PADDING, animate: false, bearing: 0, pitch: 0 });

      // The whole city is as far out as you may go; pinching in is free.
      map.setMinZoom(map.getZoom());
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

    /*
     * One finger only. A touch event's point is the centroid of every finger
     * down, so a second one turns the reading into the midpoint between them
     * -- somewhere nobody pointed at -- and would put back the readout that
     * starting to pan has just taken away.
     */
    if (event.originalEvent.touches.length > 1) {
      pendingPoint = null;
      onLeave();
      return;
    }

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
