/**
 * Villa Pérez — soplido opcional para acelerar el vuelo.
 * Analiza únicamente amplitud en memoria; no graba ni transmite audio.
 * El micro se activa siempre mediante un clic del usuario y se libera al salir.
 */
export const MAX_BLOW_SPEED = 10;
export const BLOW_MIN_TURBO = 3.5;
export const BASE_BLOW_SPEED = 1;

export function blowSpeedTarget(rms, noiseFloor=0) {
  if (!Number.isFinite(rms) || rms <= 0) return BASE_BLOW_SPEED;
  const floor = Math.max(0, Number.isFinite(noiseFloor) ? noiseFloor : 0);
  // Un soplido en el móvil puede registrar un RMS muy bajo.
  // La calibración anterior ignoraba soplidos y los trataba como ruido.
  const threshold = Math.max(0.008, floor * 1.35 + 0.0025);
  if (rms <= threshold) return BASE_BLOW_SPEED;
  const force = Math.sqrt(Math.max(0, Math.min(1, (rms - threshold) / 0.07)));
  return BLOW_MIN_TURBO + (MAX_BLOW_SPEED - BLOW_MIN_TURBO) * force;
}

export function smoothBlowSpeed(current, target, elapsedMs=70) {
  const from = Math.max(BASE_BLOW_SPEED, Math.min(MAX_BLOW_SPEED, current));
  const to = Math.max(BASE_BLOW_SPEED, Math.min(MAX_BLOW_SPEED, target));
  const tau = to > from ? 70 : 360; // ataque inmediato y retorno suave
  const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / tau);
  return from + (to - from) * alpha;
}

export class BlowBoost {
  constructor() {
    this.active = false;
    this.pending = false;
    this.requestId = 0;
    this.stream = null;
    this.context = null;
    this.source = null;
    this.filter = null;
    this.analyser = null;
    this.samples = null;
    this.startedAt = 0;
    this.lastSampleAt = 0;
    this.noiseFloor = 0.006;
    this.speed = BASE_BLOW_SPEED;
  }

  async start() {
    if (this.active) return true;
    if (this.pending) return false;
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error('El micrófono necesita HTTPS y un navegador compatible.');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('El navegador no admite análisis del micrófono.');

    this.pending = true;
    const request = ++this.requestId;
    let stream;
    let context;
    try {
      // Crear el AudioContext durante el toque del usuario (Safari iPhone).
      context = new AudioContextClass();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        },
        video: false
      });
      if (request !== this.requestId) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      const source = context.createMediaStreamSource(stream);
      const filter = context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 110;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.08;
      source.connect(filter);
      filter.connect(analyser);
      // Nunca conectar a context.destination: no hay reproducción de la voz.
      await context.resume();
      if (request !== this.requestId) {
        stream.getTracks().forEach(track => track.stop());
        void context.close();
        return false;
      }
      this.stream = stream;
      this.context = context;
      this.source = source;
      this.filter = filter;
      this.analyser = analyser;
      this.samples = new Float32Array(analyser.fftSize);
      this.startedAt = performance.now();
      this.lastSampleAt = 0;
      this.noiseFloor = 0.006;
      this.speed = BASE_BLOW_SPEED;
      this.active = true;
      stream.getAudioTracks().forEach(track => {
        track.addEventListener('ended', () => this.stop(), { once: true });
      });
      return true;
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (context) void context.close().catch(() => {});
      throw error;
    } finally {
      if (request === this.requestId) this.pending = false;
    }
  }

  sample(now=performance.now()) {
    if (!this.active || !this.analyser) return BASE_BLOW_SPEED;
    if (this.lastSampleAt && now - this.lastSampleAt < 65) return this.speed;
    const elapsed = this.lastSampleAt ? Math.min(250, now - this.lastSampleAt) : 70;
    this.lastSampleAt = now;

    this.analyser.getFloatTimeDomainData(this.samples);
    let power = 0;
    for (let i=0; i<this.samples.length; i++) power += this.samples[i] ** 2;
    const rms = Math.sqrt(power / this.samples.length);

    // Calibrar solo silencio: soplar justo al activar el permiso funciona.
    const threshold = Math.max(0.008, this.noiseFloor * 1.35 + 0.0025);
    if (now - this.startedAt < 450 && rms < threshold) {
      this.noiseFloor = this.noiseFloor * 0.75 + rms * 0.25;
    }
    const target = blowSpeedTarget(rms, this.noiseFloor);
    if (target === BASE_BLOW_SPEED) {
      this.noiseFloor = this.noiseFloor * 0.995 + Math.min(rms, 0.015) * 0.005;
    }
    this.speed = smoothBlowSpeed(this.speed, target, elapsed);
    if (this.speed < 1.015) this.speed = BASE_BLOW_SPEED;
    return this.speed;
  }

  stop() {
    this.requestId++;
    this.active = false;
    this.pending = false;
    this.speed = BASE_BLOW_SPEED;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.source?.disconnect();
    this.filter?.disconnect();
    this.analyser?.disconnect();
    this.source = this.filter = this.analyser = this.samples = null;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
