# Laboratorio de vuelo · Villa Pérez
Esta carpeta es una **prueba técnica independiente** del módulo `operacion-diente` y no altera Foto con Pérez.

## Enlace publicado
https://jbustoscasta.github.io/villa-perez-premium/operacion-diente/laboratorio-vuelo/

## Qué puedes comprobar
- Mapa vectorial REAL de OpenFreeMap/OpenStreetMap en Madrid (estilos noche/claro).
- Edificios 3D extruidos con datos del mapa donde existen alturas disponibles.
- Globo decorativo 2,5D moviéndose geográficamente, cámara inclinada, giro, seguimiento y estela dorada.
- Destinos públicos de ejemplo (Plaza Mayor, Bernabéu, Arroyo Fresno).
- Dirección opcional introducida por el adulto, consultada **solo al hacer clic** a Photon/Komoot; no persistimos ni enviamos direcciones a GitHub.
- Pausa, reanudación, reinicio y progresión automática.

## Limitaciones expresas
- **NO** son fachadas fotorrealistas: OpenFreeMap/MapLibre dibuja edificios 3D simplificados. Para ese efecto se necesita evaluar Google Photorealistic 3D Maps con clave y facturación.
- **NO** es un globo 3D real: el globo es un SVG ilustrado incrustado como marcador geográfico para probar cámara y escala.
- La trayectoria es un vuelo de fantasía sobre puntos geográficos reales y NO representa una ruta vial certificada, un servicio de navegación ni un recorrido exacto sobre cada calle.
- La «clínica» del ejemplo es la Puerta de Alcalá, origen ficticio de prueba, no la ubicación real de la Clínica del Doctor Abreu.
- Photon público es solo apto para esta demostración de bajo volumen, no producción comercial.
- El nombre de la calle mostrado en el vuelo es una descripción narrativa, NO geocodificación inversa.
- No existe aún prueba realizada físicamente en iPhone/Safari, sólo deploy confirmado por GitHub Actions. Requiere Wi-Fi/datos móviles y WebGL.
- No emplea ni sustituye el Ratón Pérez oficial; debe montarse como capa maestra intacta en una versión comercial.
- En el futuro el usuario solo debería introducir su domicilio; el origen se cargaría de la configuración verificada de la clínica.

## Dependencias públicas
- MapLibre GL JS 6.16.0, OpenFreeMap, OpenStreetMap.
- Geocodificación eventual Photon `https://photon.komoot.io/api/` (petición manual, durante la prueba).
- Google Fonts (tipografías; se muestran fallbacks cuando no cargan).

## Próximo experimento
Valorar cobertura y rendimiento de Google Maps JavaScript 3D en Madrid y decidir entre vista satélite fotorrealista diurna con efectos mágicos, o callejero nocturno estilizado. No prometer una imagen satélite nocturna auténtica: no equivale a encender luces reales en fotografías aéreas.
