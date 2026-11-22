# Villa Pérez — El vuelo mágico v1.0.2 (iPhone)

Aplicación estática para GitHub Pages. Dirección prevista `https://jbustoscasta.github.io/villa-perez-premium/vuelo-magico/`.

## Fotos en Safari

Abrir la dirección HTTPS en **Safari** (no un HTML descargado en el visor de ChatGPT). El botón central y el lateral usan `input type=file` nativos.

Al seleccionar una imagen JPG/PNG/HEIC, el navegador la procesa **localmente**, sin subirla a GitHub ni al servidor. El GIF/MP4 de Magnific se añade después desde el propio teléfono si se desea.

## Uso

1. Elegir una fotografía del dormitorio.
2. Dibujar la trayectoria con el dedo.
3. Señalar dónde está el diente.
4. Previsualizar y ajustar duración, tamaño y partículas.
5. Guardar fotograma o intentar exportar vídeo según las funciones multimedia admitidas por el navegador.

## Limitaciones

No se ha verificado en un iPhone físico. Algunas versiones de Safari no admiten exportación de vídeo mediante `canvas.captureStream` + `MediaRecorder`, aunque sí permiten foto y previsualización. La fotografía y el MP4 seleccionados permanecen en el dispositivo.