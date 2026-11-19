# Villa Pérez Premium · Configuración de la tarjeta con QR

## Cómo funciona

La **tarjeta física troquelada con forma de puerta** se entrega al paciente. Su QR abre **directamente la bienvenida personalizada de Villa Pérez**. No hay que escanear la tarjeta una segunda vez dentro de la aplicación.

El recorrido es: QR de la tarjeta → bienvenida de la clínica → instrucciones breves → palma u hombro → cámara o foto subida → editar a Pérez → único recuerdo vertical → guardar, compartir y reseña voluntaria.

## URL para imprimir en el QR

Base:
https://jbustoscasta.github.io/villa-perez-premium/

Parámetros admitidos:

- `clinica`: nombre visible de la clínica en todas las pantallas y en el recuerdo.
- `ciudad`: ubicación opcional.
- `maps`: enlace HTTPS de Google Maps de la clínica.
- `placeid`: Place ID real de la clínica; permite llevar al formulario de reseña con `https://search.google.com/local/writereview?placeid=...`.
- `review`: enlace directo alternativo para reseñas de Google, si la clínica lo proporciona.
- `modo`: opcional; `palma` o `hombro`.

Ejemplo de navegación (sin Place ID configurado):
https://jbustoscasta.github.io/villa-perez-premium/?clinica=Cl%C3%ADnica%20del%20Doctor%20Abreu&ciudad=Madrid

**IMPORTANTE:** no imprimir una URL con un `placeid` de prueba. Cada clínica debe proporcionar/verificar su enlace o Place ID real antes de distribuir sus tarjetas. Sin enlace directo, la pantalla identifica claramente que abrirá la búsqueda de la clínica en Google Maps para que el usuario encuentre su ficha.

La invitación a reseñar es opcional, independiente de descargar o compartir el recuerdo. No se simulan reseñas, no se elige una puntuación por el usuario y la app no publica comentarios en su nombre.

## Privacidad y personaje

La foto se compone en el navegador del usuario. El Ratón Pérez utilizado es el **archivo maestro `perez.png`**, que debe permanecer intacto. Los fondos, la tarjeta y la fachada son capas decorativas independientes.
