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


## v2.0 · Arquitectura mágica de verdad (20/11/2026)

Se mantiene la foto PNOA y el volumen de los edificios cartografiados por OSM.
El render no fabrica nuevas huellas ni calles. Añade **ornamentación artística** ligada a las coordenadas reales:

- Nuevo `architecture-v2.mjs` con luces de ventana en fachadas 3D, marcos, molduras y cornisas.
- Remates de tejado de diferentes colores; tejados inclinados pequeños en huellas compactas y convexas, y algunas chimeneas / luces decorativas en azoteas. No son una reconstrucción fiel del tejado existente: son embellecimiento deliberado.
- Ortofoto de noche algo más legible, fachadas con más luz y calles cálidas siguiendo datos OSM.
- `magic-atmosphere-v2.mjs` separado: estela de polvo dorado, niebla suave, brillo bajo el globo y estrellas fugaces.
- Cámara más próxima a los edificios y giros más fluidos.
- Menos obstrucción visual por interfaz y nombres de calles en el modo nocturno.
- Botón Magia sigue apagando o encendiendo la arquitectura estilizada y la estela; se mantiene el 3D básico del callejero.
- Máximo orientativo 85.000 vértices adicionales en móvil y sin otro contexto WebGL.
- Copia GitHub de seguridad: `backup/vuelo-real-magico-before-fantasy-v2`.

### Verificación y límites

Comprobaciones estáticas: sintaxis JS, IDs HTML, referencias de archivos. Geometría 3D sintética de prueba sobre **huellas de edificios**: sin huellas no se produce ninguna decoración; polígonos reales de prueba generan ventana/moldura/cubierta; límite de vértices respetado.

No se ha podido validar visualmente en Safari físico desde esta sesión. El resultado puede diferir de la captura original de `demos.ilusiono.com`, cuyo motor de hosting sigue sin estar accesible por los conectores disponibles.

La versión no se ha instalado en `demos.ilusiono.com`. Solo vive en GitHub Pages; conserva dicha demo original.
