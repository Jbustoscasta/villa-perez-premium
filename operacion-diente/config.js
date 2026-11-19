/** Configuración de integración futura: sustituir por datos de la clínica autenticados en backend. */
export const APP_CONFIG = {
  clinic: {
    id: 'demo-abreu',
    name: 'Clínica del Doctor Abreu',
    // NO conocemos la dirección real de esta clínica. Punto turístico temporal para demostración.
    origin: [-3.68845, 40.42016],
    originLabel: 'Puerta de Alcalá, Madrid · ORIGEN DE PRUEBA',
    demo: true
  },
  // Exclusivamente servicios públicos de prueba, sin garantías; deben sustituirse antes de vender.
  services: {
    mapStyle: 'https://tiles.openfreemap.org/styles/liberty', // High-detail vector base, restyled on load in premium-map.mjs
    geocoder: 'https://photon.komoot.io/api/',
    router: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/'
  },
  defaultCenter: [-3.68845, 40.42016],
  defaultZoom: 12,
  stageDurationSeconds: 190,
  // When original approved audio files exist, put their same-origin relative paths here.
  // Never impersonate the official voice using browser speech synthesis.
  narrationAudio: {
    // intro: './audio/raton-oficial-salida.mp3',
    // depart: './audio/raton-oficial-camino.mp3',
    // halfway: './audio/raton-oficial-mitad.mp3',
    // scenic: './audio/raton-oficial-lugar-especial.mp3',
    // near: './audio/raton-oficial-llegada.mp3',
    // morning: './audio/raton-oficial-buenos-dias.mp3'
  },
  // En producción las imágenes son las mismas que en la app de Foto con Pérez.
  assets: { facade: '../villa-hero.webp', character: '../perez.png' }
};