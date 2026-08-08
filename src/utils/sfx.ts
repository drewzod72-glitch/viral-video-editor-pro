// Web Audio API Synthesizer for high-production viral social media sound effects (SFX)
// Zero-external network dependencies, 100% reliable local client audio generation.

/**
 * Plays a synthesized SFX effect.
 *
 * @param type - The SFX type to play
 * @param destination - Optional AudioNode destination. If provided, the SFX
 *   is routed into that node (e.g. a MediaStreamDestination for recording).
 *   If omitted, the SFX plays through the default speakers.
 * @param externalCtx - Optional AudioContext to use. If provided, the SFX
 *   is generated through this context (required when routing into a
 *   MediaStreamDestination from a specific AudioContext).
 */
export function playViralSFX(
  type: 'whoosh' | 'pop' | 'bell' | 'swoosh' | 'laser' | 'shutter',
  destination?: AudioNode,
  externalCtx?: AudioContext
): void {
  try {
    const ctx = externalCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const dest = destination || ctx.destination;

    if (type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'whoosh') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.22);
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(5, now);
      filter.frequency.setValueAtTime(150, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.22);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'shutter') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(1000, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2500, now);
      osc.frequency.exponentialRampToValueAtTime(8000, now + 0.01);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.12, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      osc.connect(oscGain);
      oscGain.connect(dest);
      noiseNode.start(now);
      noiseNode.stop(now + 0.08);
      osc.start(now);
      osc.stop(now + 0.02);
    } else if (type === 'swoosh' || type === 'laser' || type === 'bell') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type === 'bell' ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(type === 'bell' ? 980 : 800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // SFX failure should never crash the renderer
  }
}
