# Villa Pérez — Vuelo mágico v1.3

URL: https://jbustoscasta.github.io/villa-perez-premium/vuelo-magico/?v=130

Editor de vuelo privado y móvil: foto local de la habitación, ruta dibujada, diente, globo animado de Wan 3.0 Prime con chroma, contraste adaptativo nocturno y grabación en el propio navegador.

## Qué cambia
- Controles «Ruta / Diente / Mover» superpuestos en la foto. Marco táctil para escalar el globo y deslizador dentro de la escena.
- «Ver vuelo» dentro de la imagen. «Crear vídeo» accesible en barra fija desde iPhone.
- Luz nocturna automática por zona bajo el globo, con interruptor Auto y ajuste manual 30-150%.
- Sonido nuevo: **grabación de campo real** de quemador (CC0), soplidos con cadencia natural y destellos originales no repetitivos; sin música.
- Ajustes opcionales plegables: duración, intensidad de partículas, zoom foto, cromas, volumen y calidad.
- Estado y ajustes conservados localmente. Foto y vídeo final nunca se suben a un servidor.
- Pruebas automatizadas en Chromium y WebKit, móvil y escritorio: `tests/smoke.mjs`.

## Cómo probar desde iPhone
1. Abrir enlace anterior en **Safari**, no el visor de archivos de ChatGPT.
2. Pulsar «Elegir una fotografía»; si se repite la prueba tocar «Cambiar foto».
3. Dibujar una ruta y tocar «Diente» para marcar la mesita si se desea.
4. Ajustar escala arrastrando la esquina del recuadro; tocar ☾ para ver y modificar la iluminación.
5. Pulsar «▶ Ver vuelo»; cuando guste, «✦ Crear vídeo».

El vídeo base de 15s es `assets/raton-perez-vuelo.mp4` (chroma #00FF00; la webapp elimina el fondo en tiempo real). La miniatura PNG solo aparece como respaldo si el vídeo no puede reproducirse. El audio es `assets/sonido-vuelo-real.mp3`.

## Licencia de sonido y detalles técnicos
Ver `SOUND-DESIGN.md`. La grabación del quemador original se distribuye bajo CC0, y el resto del diseño sonoro es nuevo. No se ha usado ninguna otra generación de vídeo con IA.

## Limitaciones
La exportación es local mediante MediaRecorder y depende de la implementación del navegador. Los navegadores pueden producir MP4 o WebM; no se garantiza guardado en «Fotos» desde todas las versiones de iOS. Queda por verificar físicamente en Safari iPhone, además de las pruebas simuladas WebKit.
