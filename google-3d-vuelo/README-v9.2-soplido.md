# Villa Pérez · Soplido para acelerar el globo (v9.5)

## Qué cambia

- Botón **🎤 Activar soplido** en la barra inferior del vuelo.
- Botón **🌬 Soplar** también en el modo inmersivo 360º.
- Se solicita permiso de micrófono después de una pulsación explícita.
- Un soplido suave acelera y uno intenso alcanza un máximo de **×10**.
- Cuando el niño deja de soplar se reduce progresivamente hasta ×1. Se ha corregido la calibración inicial para aceptar un soplido inmediato y el límite temporal de fotogramas de Safari con mapas 3D pesados.
- Solo se acelera la fase de vuelo por la ruta original, no el despegue ni la órbita final; no cambia el destino ni los últimos metros privados.
- Al pausar, finalizar, reiniciar o salir de la pestaña se detiene el micrófono y se liberan las pistas.
- Sin permiso o sin micrófono, la app sigue funcionando con la velocidad habitual.

## Privacidad

Se analizan pequeñas muestras de audio mediante Web Audio API en el propio navegador, sin conectarlas a altavoces, grabarlas ni enviarlas a servidores. La API requiere HTTPS. Safari iPhone debe probarse en el dispositivo real y quizás ajustar el umbral, ya que el procesamiento de audio difiere por hardware.

## Pruebas

`node --test google-3d-vuelo/tests/blow-boost.test.mjs`

Comprobar en iPhone: autorizar/rechazar permisos, soplar suave/fuerte, retorno a velocidad x1, pausar, reiniciar, entrar en 360º, volver al navegador y cerrar pestaña. Verificar la ubicación del botón con los controles y las atribuciones de Google Maps.

## Publicación

Los cambios se preparan en una rama de pruebas **feature/soplido-acelera-globo**; el directorio publicado en `main` no se modifica hasta la revisión.

## URL de prueba (sin modificar la app original)

https://jbustoscasta.github.io/villa-perez-premium/google-3d-vuelo/soplido-preview.html?v=9.5.0
