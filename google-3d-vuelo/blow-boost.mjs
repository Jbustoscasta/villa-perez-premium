/**
 * Villa Pérez — soplido opcional para acelerar el vuelo.
 * Analiza únicamente amplitud en memoria; no graba ni transmite audio.
 * El micro se activa siempre mediante un clic del usuario y se libera al salir.
 */
export const MAX_BLOW_SPEED = 2.8;
export const BASE_BLOW_SPEED = 1;

export function blowSpeedTarget(rms, noiseFloor=0) {
  if (!Number.isFinite(rms) || rms <= 0) return BASE_BLOW_SPEED;
  const floor = Math.max(0, Number.isFinite(noiseFloor) ? noiseFloor : 0);
  // Umbral adaptativo + mínimo absoluto para evitar activación por ruido ambiente.
  const threshold = Math.max(0.028, floor * 3.2 + 0.015);
  const force = Math.max(0, Math.min(1, (rms - threshold) / 0.095));
  return BASE_BLOW_SPEED + (MAX_BLOW_SPEED - BASE_BLOW_SPEED) * force;
}

export function smoothBlowSpeed(current, target, elapsedMs=70) {
  const from = Math.max(BASE_BLOW_SPEED, Math.min(MAX_BLOW_SPEED, current));
  const to = Math.max(BASE_BLOW_SPEED, Math.min(MAX_BLOW_SPEED, target));
  const tau = to > from ? 145 : 530; // respuesta rápida, retorno progresivo
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
    this.noiseFloor = 0.008;
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
      this.noiseFloor = 0.008;
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

    if (now - this.startedAt < 450) {
      // Calibración inicial corta antes de pedir que sople.
      this.noiseFloor = this.noiseFloor * 0.82 + rms * 0.18;
      return BASE_BLOW_SPEED;
    }

    const target = blowSpeedTarget(rms, this.noiseFloor);
    if (target <= BASE_BLOW_SPEED + 0.01) {
      this.noiseFloor = this.noiseFloor * 0.995 + Math.min(rms, 0.04) * 0.005;
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
