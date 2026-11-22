# Villa Pérez — El vuelo mágico v1.1.0

Aplicación publicada en https://jbustoscasta.github.io/villa-perez-premium/vuelo-magico/ y adaptada para Safari de iPhone.

## Vídeo del globo integrado

La aplicación carga automáticamente `assets/raton-perez-vuelo.mp4` (15 s, H.264 optimizado, 480 píxeles de ancho). Es el vídeo de Wan 3.0 Prime generado previamente en Magnific. El vídeo **no tiene transparencia en el archivo original**: la webapp elimina el fondo verde en tiempo real, localmente, para mostrar solo al Ratón Pérez sobre la foto. El globo sigue el recorrido dibujado con el dedo y mantiene la escala fijada en el control de tamaño. La tarjeta lateral puede seguir mostrando una miniatura fija como referencia visual.

Si el archivo no carga, se puede cargar otro MP4 propio con «Cargar otro vídeo». Una imagen del globo sirve únicamente de respaldo mientras el vídeo está cargando.

## Cómo utilizar

1. Abrir el sitio online directamente en Safari (no en el visor de ChatGPT).
2. Seleccionar una foto de la habitación desde el dispositivo.
3. Dibujar el recorrido con el dedo; opcionalmente marcar dónde está el diente.
4. Reproducir, cambiar tamaño, duración, velocidad y brillo de las partículas.
5. Exportar en el navegador si este admite `canvas.captureStream` + `MediaRecorder`.

La fotografía permanece en el dispositivo. El vídeo público está servido desde GitHub Pages; el chroma y la exportación se ejecutan en el navegador.

## Limitaciones

No se ha probado físicamente en Safari de iPhone. Puede haber incompatibilidades de reproducción o exportación en iOS; la exportación también está condicionada al codec y a `MediaRecorder` del sistema. No modifica la portada ni los demás módulos del repositorio.