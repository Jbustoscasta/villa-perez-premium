# Villa Pérez — Vuelo real mágico 3D (prototipo independiente)

**Web pública:** https://jbustoscasta.github.io/villa-perez-premium/vuelo-real-magico/?v=1.0.0

## Qué representa
Inspirado visualmente en la captura de demos.ilusiono.com. No es copia del código hospedado: su fuente no se pudo leer con los accesos actuales. Este prototipo es independiente y NO modifica el hosting original.

## Avances respecto al anterior vuelo-cine
- Foto aérea PNOA/IGN por debajo de la geometría.
- Edificios sobre huellas reales OSM en 3D, con alturas/plantas cartografiadas cuando existen (fill-extrusion), sin edificios ficticios ni inventar tejados.
- Cámara rasante a pitch 76° y rumbo dinámico.
- Luces de ventanas tridimensionales sobre fachadas de los propios edificios OSM, destellos sobre tejados cartografiados, halos en vías de verdad.
- Polvo mágico desde la cesta, neblina tenue, estrella fugaz ocasional, botón para desactivar Magia.
- Globo y Ratón Pérez originales reutilizados sin redibujarlos.
- Modo día/noche, minimapa, vuelo automático, pausa, vista general, vista subjetiva 360° con sensor sujeto a permiso Safari, o arrastre manual.
- Si WebGL no está disponible, informa del problema en vez de degradarse silenciosamente a un mapa plano.

## Fuentes y dependencias
- MapLibre GL JS 5.7.0 por CDN.
- OpenFreeMap/OpenStreetMap para geometría y alturas disponibles.
- PNOA máxima actualidad del IGN para fotografía aérea.
- Photon y OSRM son servicios comunitarios usados solamente para la demo y no garantizan disponibilidad. Si no hay ruta real, se indica claramente que el recorrido es aproximado.
- No se almacenan domicilios familiares; los recorridos se interrumpen antes del portal.
- Las atribuciones del proveedor cartográfico permanecen visibles.

## Limitaciones
- El motor específico publicado en demos.ilusiono.com no ha podido recuperarse; puede tener una cartografía 3D más detallada que OpenStreetMap. Por eso no se garantiza el mismo edificio exacto ni todos los acabados de los tejados.
- La luz de ventanas es una recreación artística, no iluminación observada.
- Esta implementación no incluye la malla topográfica de relieve IGN original (no se ha obtenido esa configuración de hosting), aunque sí ortofotografía real y edificios 3D.
- Pendiente una prueba visual y de rendimiento en un iPhone físico. En esta sesión solo se han comprobado sintaxis y estructura estática.
- Para producción comercial deben reemplazarse servicios de prueba y auditar licencias, privacidad y rendimiento.

## Ficheros
- index.html: UI y elementos del globo oficial.
- styles.css: tema móvil nocturno.
- engine.mjs: mapa real 3D, ruta y controles.
- Se reutilizan los módulos de luces 3D reales y partículas de ../vuelo-cine/, que no inventan casas.

## Prueba de aceptación en Safari
1. Comprobar que se ven paredes y volumen y no una ortofoto plana.
2. Probar dos rutas distintas con edificios reconocibles.
3. Magia ON/OFF no debe cambiar posiciones de casas ni calles.
4. Día/noche conserva las geometrías.
5. Vista 360° funciona arrastrando y, previa autorización, girando el móvil.
6. El último tramo hasta la vivienda permanece oculto.
7. Créditos visibles, FPS estables, sin errores WebGL.
