/**
 * The noise scale the whole site is built on.
 *
 * Each step pairs a decibel reading with the colour used for it on the Mapbox
 * style. Hovering the map reads a pixel and matches it back to one of these,
 * which is what drives the tooltip swatch, the gauge and the audio volume.
 *
 * This list is the single source of truth: the gauge derives its arc segments
 * from the measured steps, and the colour matcher derives its palette from all
 * of them. (It used to be duplicated between App.js and the gauge, which meant
 * a colour could be changed in one place and not the other.)
 */
export const STEPS = [
  { value: 35, label: '< 40', color: '#feebe2' },
  { value: 40, label: '40', color: '#fdd0ce' },
  { value: 45, label: '45', color: '#fbb4b9' },
  { value: 50, label: '50', color: '#f98ead' },
  { value: 55, label: '55', color: '#f768a1' },
  { value: 60, label: '60', color: '#de4196' },
  { value: 65, label: '65', color: '#c51b8a' },
  { value: 70, label: '70', color: '#a00e81' },
  { value: 75, label: '75', color: '#7a0177' },

  /*
   * Negative values are the map's unmeasured areas — parks, water, blank
   * ground. They are in the palette so that hovering them matches something
   * rather than snapping to the nearest loud colour, and a negative match
   * silences the audio and hides the gauge needle.
   */
  { value: -1, label: 'NA', color: '#d5d5d5' },
  { value: -2, label: 'NA', color: '#eef0f0' },
  { value: -4, label: 'NA', color: '#ffffff' },
  { value: -5, label: 'NA', color: '#cccccc' },
];

/** The nine steps that represent a real reading, in ascending order. */
export const MEASURED_STEPS = STEPS.filter((step) => step.value > 0);
