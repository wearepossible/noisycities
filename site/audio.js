/**
 * The city noise loop, and the volume that follows the reading under the
 * cursor.
 *
 * Volume is applied with a Web Audio gain node rather than the audio element's
 * own `volume` property. On iOS that property is read-only: assignments to it
 * are silently ignored, because Apple reserves loudness for the hardware
 * buttons. The loop therefore played at one flat level on iPhones and iPads no
 * matter how loud the street under your finger was — which is most of the
 * point of the site. Gain is honoured everywhere.
 *
 * If the Web Audio API is unavailable or refuses to start, this falls back to
 * setting `volume` directly, which is what the site did before.
 */

export function createAudio(element) {
  let context = null;
  let gain = null;
  let volume = 0;

  /**
   * Route the element through a gain node.
   *
   * Only ever runs once — an element can have a single media-element source —
   * and only from a user gesture, since browsers will not start an audio
   * context without one.
   */
  function ensureGraph() {
    if (context) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      context = new AudioContextClass();
      const source = context.createMediaElementSource(element);
      gain = context.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(context.destination);

      // The element's own volume now sits in front of the gain node, so it has
      // to stay at 1 or the two would multiply.
      element.volume = 1;
    } catch {
      // Leave the graph unbuilt and keep using element.volume.
      context = null;
      gain = null;
    }
  }

  return {
    /** Volume from 0 to 1. */
    setVolume(next) {
      volume = next;
      if (gain) {
        gain.gain.value = next;
      } else {
        element.volume = next;
      }
    },

    setMuted(muted) {
      element.muted = muted;
    },

    /**
     * Turn the sound on. Must be called from a click or tap: that is what lets
     * the audio context start, and what lets playback begin at all.
     */
    enable() {
      ensureGraph();
      if (context && context.state === 'suspended') context.resume();

      const started = element.play();
      if (started && started.catch) {
        started.catch(() => {
          /* Refused by the browser; the mute button is still there. */
        });
      }
    },

    /**
     * The volume last asked for, whichever path is applying it. Reading it
     * back off the element would report 1 once the gain node is in use.
     */
    get volume() {
      return volume;
    },

    /** Whether the gain node is in use, rather than the element's volume. */
    get usesGain() {
      return Boolean(gain);
    },
  };
}
