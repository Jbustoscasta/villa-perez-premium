# Villa Pérez · Vuelo fotorrealista v5.1 (versión principal)

URL: https://jbustoscasta.github.io/villa-perez-premium/google-3d-vuelo/?v=5.1.0

## Decisiones visuales
- **Solo Google Maps JavaScript 3D en SATELLITE**. Edificios fotorrealistas, sin casas geométricas inventadas ni filtros nocturnos.
- **Ratón Pérez maestro**: se carga de `../perez.png` sin alterar el archivo. No se usa GLB ni marcador 3D para el personaje.
- **Globo dibujado a mano en SVG en dos capas**, independientes, con degradados de seda, costuras, latón, cuerda, relieve y mimbre:
  - `assets/globo-cinematico.svg`: envoltura, herrajes, fuego y cesta posterior.
  - `assets/cesta-cinematica.svg`: cesta delantera que tapa solamente los pies del Ratón.
- En pantalla se ven los edificios reales y el globo como composición superpuesta, no hay oclusión 3D que pueda esconderlo.

## Cámara rasante y giros
- Distancia cámara–objetivo: **270 m** (v5.0: 495 m). Inclinación: **67°**. Sin zooms ni saltos de altura durante la ruta.
- Altitud de objetivo con Elevation API habilitada: terreno estimado + **52 m**. La cámara queda más alta que el objetivo debido a la distancia y tilt; esa cifra no representa su altura física sobre el asfalto.
- Altitud de objetivo de respaldo sin Elevation API: **733 m absolutos**, pensada para pruebas de Madrid. No garantiza una distancia segura al terreno para clínicas de otras regiones. Habilitar Elevation es recomendable para producción y tiene coste/cuotas.
- Anticipación de giros con muestras de la ruta **55–115 m** por delante. Filtro temporal amortiguado y tope de **19°/s** en la ruta; no hay cambios inmediatos de heading en cada intersección.
- Se interpola la posición de la cámara, como máximo con una desviación objetivo de ~9 m respecto a la trayectoria, sin modificar la línea real de ruta.
- Desde la vista general hay un **zoom/cambio de inclinación progresivo de 2,6 segundos** antes del vuelo bajo.
- Órbita final suave de **270° en 21 segundos**, con entrada y salida amortiguadas. Vuelo principal 42–85 s según distancia.

## Rutas
- Origen: dirección de clínica configurable una vez. Si no existe, Puerta de Alcalá claramente etiquetada como lugar de demostración.
- Destino: dirección escrita por el padre. La ruta se obtiene mediante Google Routes cuando está habilitada; si no, se indica que el recorrido es panorámico aproximado.
- Los últimos ~180 m de destinos particulares no se muestran como entrada al portal.

## APIs y privacidad
- Maps JavaScript API con acceso a 3D, Geocoding API (destinos nuevos), Routes API (trazado por calles), **Elevation API opcional**. Los servicios externos reciben las coordenadas consultadas y pueden incurrir en costes.
- La clave introducida para la demo queda en sessionStorage de ese navegador; en producción la clínica debe ir preconfigurada y la clave restringida por dominios/servicios.
- Respetar los créditos y términos de Google. No extraer/capturar tiles ni convertir fotos de Google en escenas nocturnas generadas por IA.

## Pruebas realizadas
- Sintaxis JavaScript, nombres de IDs de HTML y referencias SVG.
- Comprobación estática de etiquetas/definiciones de SVG y presencia del PNG oficial original.
- Simulación de recorrido con intersecciones de 90°: tope 19°/s confirmado.
- Simulación del caso Elevation API habilitada y deshabilitada.
- Vista general, despegue, vuelo, pausa, volver a vista general, 270° de llegada, finalización y reinicio.
- GitHub Actions / Pages completado correctamente.

**Límite de validación:** no se ha inspeccionado el renderizado visual real en Safari físico. Tampoco se garantiza la cobertura fotorrealista 3D de todas las direcciones. Una prueba de campo con iPhone es necesaria antes del lanzamiento.
