/**
 * High-performance, zero-leak WebAudio Singleton for Android TV & Desktop UI navigation.
 * Prevents "The number of hardware contexts provided by the Platform has been exceeded" crash.
 */

let sharedAudioCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }

    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// User-interaction wakeup listener to ensure audio is unblocked on TV remote press
if (typeof window !== "undefined") {
  const resumeAudio = () => {
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener("keydown", resumeAudio, { passive: true, once: false });
  window.addEventListener("click", resumeAudio, { passive: true, once: false });
  window.addEventListener("touchstart", resumeAudio, { passive: true, once: false });
}

export function playTvBeep(freq = 580, duration = 0.035, volume = 0.04): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Graceful fallback if audio is blocked
  }
}

export function playTvNavBeep(): void {
  playTvBeep(640, 0.025, 0.035);
}

export function playTvSelectBeep(): void {
  playTvBeep(750, 0.045, 0.05);
}

export function playTvBackBeep(): void {
  playTvBeep(430, 0.04, 0.04);
}

export function playTvErrorBeep(): void {
  playTvBeep(220, 0.08, 0.05);
}
