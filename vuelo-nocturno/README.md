# Vuelo nocturno · prototipo FUNCIONAL independiente

**Directorio:** `/vuelo-nocturno/`. La app de Foto con Pérez, en la raíz del repositorio, y `operacion-diente/` permanecen sin modificaciones.

## Abrir

- https://jbustoscasta.github.io/villa-perez-premium/vuelo-nocturno/
- Demo directa sin domicilio: https://jbustoscasta.github.io/villa-perez-premium/vuelo-nocturno/?demo=1

El padre escribe y **selecciona un destino real** en Photon, y el módulo solicita una **ruta peatonal auténtica** en OSRM desde Puerta de Alcalá (solo **clínica de prueba**, no es la ubicación real de Doctor Abreu). La cámara acompaña un globo animado **sobre las coordenadas de dicha ruta**, con transiciones suaves, edificios 3D, una estela sobre las calles y una vista panorámica. El niño no está viendo seguimiento GPS de un ratón real: es una simulación.

Para la demo rápida se usa Puerta de Alcalá → Plaza Mayor. Cuando el enrutador comunitario no responde en la demo, se usa un trazado de muestra explícitamente marcado **«NO ruta calculada»**. Si un padre introduce un destino y no existe respuesta del servicio, se muestra un error: **nunca se le presenta una geometría inventada como real**.

## Las dos vistas cartográficas

### Sin token: 3D vectorial gratuito (funciona sin Mapbox)

MapLibre GL JS + OpenFreeMap Liberty, edificios con alturas OSM, cámara inclinada, colores nocturnos y globo superpuesto. **No es fotografía aérea fotorrealista**. Es un modo de prueba de funcionamiento y fallback.

### Con token público Mapbox: fotografía aérea + 3D + noche

En «Mejorar realismo con satélite 3D», introducir **solo un token público Mapbox que empiece por `pk.`**, no un token secreto, y pulsar «Activar satélite fotorrealista 3D». El visor cambia a Mapbox Standard Satellite y activa `lightPreset: night`, edificios 3D, cámara inclinada y globo. Mapbox GL JS requiere un token público que normalmente es visible en el navegador; recomienda restringir el origen a GitHub Pages. **No se escribe el token en GitHub ni en localStorage**. Las fotos aéreas capturadas de día **no pasan a ser fotos reales de noche**: la noche y luces se simulan por el renderer.

**No sustituir Mapbox por Google 3D Tiles sin revisar sus condiciones para el EEE y apps dirigidas a niños.**

## Arquitectura

- `index.html`: interfaz full-screen móvil, formulario geocodificado y globo SVG. El Ratón es **solo** la imagen oficial `../perez.png` como recurso intacto, sin redibujarlo.
- `styles.css`: experiencia de vuelo nocturno, globo, UI mínima, Safari y `prefers-reduced-motion`.
- `flight-core.mjs`: distancia real, rumbo, interpolación a lo largo de geometría real, corte de privacidad de los últimos ~180 m del domicilio, formateo en español.
- `flight-app.mjs`: providers 3D, autocompletado Photon, OSRM peatón, vuelo de cámara, proyección y estela; evita conservar direcciones familiares en almacenamiento.
- `tests/flight-core.test.mjs`: tests puros sin dependencia de internet.

La simulación tarda ~95 segundos. Pausar, continuar, repetir y alternar cámara globo / panorámica. El final no revela el portal domiciliario.

## Poner en marcha y testear

```bash
python -m http.server 8000
# abrir http://localhost:8000/vuelo-nocturno/
node --test vuelo-nocturno/tests/*.test.mjs
node --check vuelo-nocturno/flight-app.mjs
```

Se requiere HTTPS en servidor público y acceso desde el dispositivo a MapLibre CDN, OpenFreeMap, Photon y OSRM. Los servidores de Photon y OSRM usados son **comunitarios, sujetos a límites y sin SLA**: antes de atender clínicas comerciales necesitarán infraestructura o proveedor contratado, garantías de privacidad y control de cuotas.

### Limitaciones de la versión actual

- No hay fotogrametría completa de cada edificio sin proveedor 3D licenciado; la vista Mapbox Standard Satellite aproxima la estética aérea HELLO, pero no está verificada visualmente en Safari desde este entorno.
- No hay modelo tridimensional riggeado del Ratón: su imagen oficial PNG intacta aparece en la cesta del globo SVG original. El globo es un elemento DOM perspectivo sobre un mapa 3D real, **no** un modelo Three.js con oclusión física por los edificios.
- La geocodificación y el motor de ruta procesan las direcciones mientras se hace la petición. Las coordenadas no se almacenan, no se incluyen en URLs ni postales; el último tramo domiciliario queda oculto. Para producción es necesaria revisión de protección de datos de menores y acuerdos con proveedores.
- La capacidad de los mapas 3D y los edificios depende del proveedor y de los datos disponibles en cada zona; el efecto nocturno no ilumina todas las ventanas individualmente.
