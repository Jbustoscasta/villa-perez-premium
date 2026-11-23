# Villa Pérez — Vuelo mágico v1.4

URL: https://jbustoscasta.github.io/villa-perez-premium/vuelo-magico/?v=130

Editor de vuelo privado y móvil: foto local de la habitación, ruta dibujada, diente, globo animado de Wan 3.0 Prime con chroma, contraste adaptativo nocturno y grabación en el propio navegador.

## Cámara Mágica guiada (v1.4)

- Entrada principal «Hacer foto mágica»; también disponible cuando ya hay una foto.
- Visor de cámara real dentro del sitio HTTPS, usando la cámara trasera mediante `navigator.mediaDevices.getUserMedia` y un vídeo con `playsinline`.
- Guía vertical **9:16**, con un marco punteado en el 39 % superior y un globo semitransparente. Indica colocar cama y niño debajo de la guía.
- Aviso de fotografía demasiado oscura (sin impedir disparar). Recomendación de utilizar luz tenue sin flash.
- Captura JPEG local recortada al MISMO 9:16 que se veía en el visor, sin enviar imagen a servidores; revisión inmediata, repetir o aceptar.
- Al aceptar, la fotografía entra en el editor y se propone una ruta de globo por el espacio superior reservado.
- Si no se conceden permisos o falta cámara, el padre puede subir una imagen de la galería. Todas las pistas de cámara se detienen al cerrar, repetir o aceptar.
- El permiso de cámara se solicita **solo al tocar el botón**. Para las pruebas se simula cámara/permiso; se requiere validar la captura nativa en un iPhone real antes de lanzamiento general.

## Qué cambia
- Controles «Ruta / Diente / Mover» superpuestos en la foto. Marco táctil para escalar el globo y deslizador dentro de la escena.
- «Ver vuelo» dentro de la imagen. «Crear vídeo» accesible en barra fija desde iPhone.
- Luz nocturna automática por zona bajo el globo, con interruptor Auto y ajuste manual 30-150%.
- Sonido nuevo: **grabación de campo real** de quemador (CC0), soplidos con cadencia natural y destellos originales no repetitivos; sin música.
- Ajustes opcionales plegables: duración, intensidad de partículas, zoom foto, cromas, volumen y calidad.
- Estado y ajustes conservados localmente. Foto y vídeo final nunca se suben a un servidor.
- Pruebas automatizadas en Chromium y WebKit, móvil y escritorio: `tests/smoke.mjs`.

## Cómo probar desde iPhone
1. Abrir la URL en **Safari** (HTTPS; no en el visor de ChatGPT).
2. Tocar **Hacer foto mágica** y permitir el acceso a la cámara.
3. Mantener el teléfono vertical, con la cama y el niño en la mitad inferior y el marco superior libre; tocar el disparador circular.
4. Tocar **Repetir foto** o **Usar esta foto**. Al aceptarla se abre el editor con una ruta de vuelo propuesta.
5. Ajustar ruta, escala o iluminación, reproducir y pulsar **Crear vídeo**.

Si no se permite usar la cámara, utilizar **Galería**. También se puede subir una foto preexistente desde la pantalla principal.

El vídeo base de 15s es `assets/raton-perez-vuelo.mp4` (chroma #00FF00; la webapp elimina el fondo en tiempo real). La miniatura PNG solo aparece como respaldo si el vídeo no puede reproducirse. El audio es `assets/sonido-vuelo-real.mp3`.

## Licencia de sonido y detalles técnicos
Ver `SOUND-DESIGN.md`. La grabación del quemador original se distribuye bajo CC0, y el resto del diseño sonoro es nuevo. No se ha usado ninguna otra generación de vídeo con IA.

## Limitaciones
La exportación es local mediante MediaRecorder y depende de la implementación del navegador. Los navegadores pueden producir MP4 o WebM; no se garantiza guardado en «Fotos» desde todas las versiones de iOS. Queda por verificar físicamente en Safari iPhone, además de las pruebas simuladas WebKit.
