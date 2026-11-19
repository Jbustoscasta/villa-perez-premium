# Villa Pérez — vuelo fotogramétrico 3D · versión 2.0

La prueba está en: https://jbustoscasta.github.io/villa-perez-premium/google-3d-vuelo/

### Qué cambia

- `assets/globo-villa-perez-3d.glb`: **modelo GLB real**, de 682.592 bytes, con tela 3D, secciones, costuras, latón, cuerdas, quemador y cesta. El modelo está integrado mediante `Model3DElement` en Google Maps JavaScript 3D y recibe posición geográfica por fotograma. Se utiliza la profundidad nativa del mapa; su oclusión concreta debe comprobarse en Safari.
- `../perez.png`: imagen **oficial intacta**. Está georreferenciada como `Marker3DElement`, con `drawsWhenOccluded:false`, por lo que puede ocultarse detrás de edificios. El personaje sigue siendo 2D: no se ha inventado una nueva pose ni se ha generado un rig 3D.
- `flight-native.mjs`: línea de luz situada a unos 72 m sobre el terreno, rastro de 75 posiciones como máximo, siete partículas 3D que avanzan por la ruta y estrellas orbitando al llegar. La opción ✨ Magia ON/OFF desactiva efectos complementarios pero mantiene globo y personaje.
- `app.mjs`: cámara a distancia constante (550 m), recorrido suave y órbita final de 360° con cuatro perspectivas. **Sin arco de vuelo que suba y baje continuamente.** Pausa/reanudación y reinicio.
- Ruta: por defecto se intenta `Route.computeRoutes()` (Google Maps JavaScript **Routes**). Si Google Routes no está habilitado o falla, se usa la trayectoria panorámica aproximada y se indica explícitamente. No afirmamos que la alternativa siga exactamente calles reales.
- Destino particular: Google Geocoding obtiene la ubicación y, si la ruta se calcula correctamente, se **recortan los últimos ~180 m**. Si Google Routes falla, la ruta panorámica también termina antes del portal. La dirección no se añade a la URL ni se guarda en un servidor propio.

### Requisitos

1. API key de Google Maps JavaScript con uso de Maps 3D.
2. Para domicilio escrito: Geocoding API habilitada (salvo ejemplo público).
3. Para ruta calculada por Google: Routes API habilitada y cuotas/pago según contrato de la cuenta. La Demo Key puede no incluir Routes; en ese caso la demo continúa en modo aproximado.
4. Safari moderno con capacidad gráfica para fotogrametría 3D. La opción de globo PNG está disponible mediante el selector de modo en caso de problemas con GLB.

### Límites de lo implementado

- El GLB es **un modelo procedimental propio**, no un asset cinematográfico profesional texturizado en Blender. Es tridimensional real con materiales PBR y elementos volumétricos. Refinar materiales y UVs podría aumentar el realismo.
- La ruta real proviene de calles transitables; el globo la **sobrevuela como narración ficticia**, no se simulan meteorología, vientos, obstáculos aéreos ni GPS.
- La posición del modelo se calcula respecto al terreno (`RELATIVE_TO_GROUND` a ~72 m) sin garantía de separación de todas las cubiertas de edificios altos. Revisar visualmente en cada zona.
- El Ratón oficial es marcador 3D con el PNG maestro, no rig 3D. Puede ocultarse detrás de edificios; no hay garantía de que la cesta oculte todas las partes de su imagen desde todos los ángulos.
- El oscurecimiento sigue siendo una ambientación visual sobre fotografías captadas de día; no es fotografía nocturna verdadera.
- No hemos realizado una prueba visual física en el iPhone del usuario: **debe validarse** el tamaño del globo, la calidad de la fotogrametría, la oclusión, los giros y el rendimiento.

### Pruebas
- Sintaxis, DOM y compatibilidad del módulo verificadas.
- Simulación de recorrido completo, órbita, pausa en ambas fases, reinicio y cambio de modo: ejecutada con dobles de Google Maps y temporizador virtual.
- Preparada compatibilidad para Safari mediante carga modular y alternativa PNG si el GLB no se admite.

### Licencias / privacidad
La fotogrametría es de Google Maps Platform, no se extraen ni redistribuyen teselas. Se preservan los créditos de Google en el mapa. Datos de domicilio enviados solo a Google al utilizar Geocoding/Routes, pero antes de lanzar el servicio infantil deben revisarse la protección de datos y los acuerdos con proveedores.

Referencias oficiales:
- https://developers.google.com/maps/documentation/javascript/3d/models
- https://developers.google.com/maps/documentation/javascript/3d/altitude-modes
- https://developers.google.com/maps/documentation/javascript/3d/marker-graphics
- https://developers.google.com/maps/documentation/javascript/routes/overview
- https://developers.google.com/maps/documentation/javascript/3d/best-practices
