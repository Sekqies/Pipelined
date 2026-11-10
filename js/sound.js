/**
 * PIPELINED - Retro Synthesizer Engine (Web Audio API)
 * Zero external files, 100% self-contained retro PC speaker/beeper
 */

const SoundEngine = (function() {
  let audioCtx = null;
  let enabled = false;

  function initContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, type = 'square', gainLevel = 0.08) {
    if (!enabled) return;
    try {
      initContext();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainLevel, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  return {
    toggle() {
      enabled = !enabled;
      if (enabled) {
        initContext();
        this.beep();
      }
      return enabled;
    },
    isEnabled() {
      return enabled;
    },
    beep() {
      playTone(880, 0.08, 'square', 0.07);
    },
    click() {
      playTone(1200, 0.02, 'triangle', 0.04);
    },
    blip() {
      playTone(440, 0.05, 'square', 0.05);
    },
    branchSuccess() {
      if (!enabled) return;
      playTone(523.25, 0.08, 'square', 0.06);
      setTimeout(() => playTone(659.25, 0.08, 'square', 0.06), 90);
      setTimeout(() => playTone(783.99, 0.14, 'square', 0.07), 180);
    },
    branchFail() {
      if (!enabled) return;
      playTone(330, 0.1, 'sawtooth', 0.08);
      setTimeout(() => playTone(220, 0.22, 'sawtooth', 0.08), 110);
    },
    bootChime() {
      if (!enabled) return;
      playTone(261.63, 0.1, 'square', 0.05);
      setTimeout(() => playTone(329.63, 0.1, 'square', 0.05), 100);
      setTimeout(() => playTone(392.00, 0.1, 'square', 0.05), 200);
      setTimeout(() => playTone(523.25, 0.25, 'square', 0.06), 300);
    }
  };
})();
