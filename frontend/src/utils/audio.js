export function playBeep(type = 'tap') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Success tone: high pitched rising double-beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);

      setTimeout(() => {
        try {
          const ctx2 = new AudioContext();
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx2.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1100, ctx2.currentTime);
          gain2.gain.setValueAtTime(0.1, ctx2.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.2);
          osc2.start(ctx2.currentTime);
          osc2.stop(ctx2.currentTime + 0.2);
        } catch (e) {}
      }, 100);
    } else if (type === 'undo') {
      // Undo tone: low frequency descending sweep
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Standard tap tone: short high beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch (err) {
    console.error('Audio feedback synthesis error:', err);
  }
}

export function triggerVibe(type = 'tap') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    if (type === 'success') {
      navigator.vibrate([80, 40, 120]);
    } else if (type === 'undo') {
      navigator.vibrate([150]);
    } else {
      navigator.vibrate(40);
    }
  } catch (err) {
    console.error('Haptic feedback vibration error:', err);
  }
}

export function triggerFeedback(type = 'tap') {
  playBeep(type);
  triggerVibe(type);
}
