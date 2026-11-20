# Villa Pérez · Madrid encantado v9.0

20 de noviembre de 2026

## Objetivo

Vuelo nocturno infantil sobre fotogrametría Google Maps JavaScript 3D SATELLITE, conservando la arquitectura y calles reales pero incorporando fantasía visible para niños. Mantener el globo con el Ratón Pérez oficial, la ruta, el modo 360 y la atribución obligatoria.

URL: https://jbustoscasta.github.io/villa-perez-premium/google-3d-vuelo/?v=9.0.0

## Realizado

1. Noche de mayor contraste con night-cinema-v9.mjs, Canvas 2D y sin WebGL secundario. Oscurecimiento espacial de azul noche 0.82-0.92 (opacidad de la capa, no exposición física del mapa), resplandor cálido y ligera bruma.
2. Luminarias cálidas georreferenciadas en la ruta, con destellos mágicos relativos a la malla de Google. La fuente fotográfica no se modifica.
3. Tejados encantados: módulo enchanted-roofs-v9.mjs genera localizaciones aproximadas a ambos lados de la ruta, con seis familias artísticas: buhardillas, puertas, torres, chimeneas, observatorios y faroles.
4. Tres hitos destacan como modelos GLB auténticos desarrollados para el proyecto: assets/mini-puerta-v9.glb, assets/mini-torre-v9.glb, assets/mini-observatorio-v9.glb. Se añaden como Model3DElement con altitudeMode RELATIVE_TO_MESH, orientación propia y materiales PBR. Si falla un modelo GLB, se sustituye por su marcador SVG alternativo.
5. Los detalles SVG menos importantes usan Marker3DElement de Google, se rasterizan y comparten la profundidad de escena. Hasta 12 decoraciones activas en cada momento, incluso si una ruta atraviesa numerosos barrios. Se reciclan en grupos pequeños a medida que avanza el globo para limitar la memoria y el trabajo de Safari.
6. Los controles de noche y magia alteran las decoraciones de forma separada: al ver la ciudad de día se ocultan los elementos fantásticos; al desactivar Magia se mantienen las luces urbanas de noche.
7. Se ha reducido el área de degradado en la parte inferior, para evitar que el último cuarto de la pantalla pareciera de día, respetando el área de atribuciones de Google.
8. HUD de iPhone: limita anchura, adapta texto a viewport y evita ampliación automática.

## Limitaciones que no deben confundirse con funcionalidades

Google 3D SATELLITE sigue sirviendo fotografías diurnas. Oscurecer el aspecto y añadir modelos externos NO equivale a un motor nocturno real: no se pueden reiluminar físicamente ni alterar los materiales de las fachadas fotogramétricas. La API no ofrece detección directa de polígonos de tejado para colocar cada miniatura con precisión. Las coordenadas se derivan del trazado del recorrido y un desplazamiento lateral, por lo que algunos adornos pueden aparecer sobre otras superficies. RELATIVE_TO_MESH los sitúa respecto a la superficie 3D detectada por Google, no garantiza que siempre sea una cubierta.

Solo se ha podido verificar sintaxis, modelo de escena, límites de elementos, asignación geográfica, fallbacks y GitHub Pages. Las fotos reales del iPhone con Google Maps 3D/clave válida son imprescindibles para aprobar colores, posición, percepción de profundidad, oclusión, FPS y visibilidad nocturna.

## Seguridad y recuperación

La API key de Google no se incorpora al código y continúa introduciéndose en el navegador. No se capturan ni exportan teselas de Google. La versión anterior está respaldada en backup/google-3d-v8-before-enchanted-city-v9. demos.ilusiono.com no ha sido modificado.
