# Villa Pérez · Vuelo de cine (prototipo funcional)

Ruta pública: https://jbustoscasta.github.io/villa-perez-premium/vuelo-cine/

## Por qué este motor no utiliza una captura de Google procesada con IA

Una captura 3D convertida en una imagen nocturna con IA no permitiría generar una ruta diferente al introducir cada padre su dirección ni conservaría de forma fiable la posición de las calles. Además, los términos de Google restringen la creación y reutilización de derivados de Maps. Este prototipo **no fotografía, captura, reutiliza ni edita imágenes de Google**.

En su lugar genera una **recreación nocturna dinámica con calles reales**, basada en datos de OpenStreetMap sobre OpenFreeMap, usando MapLibre GL JS. La iluminación es una decisión artística; **no son fotografías ni luces reales de cada vivienda**.

## Desarrollo implementado

1. MapLibre 3D con estilo nocturno de OpenFreeMap (y conmutador al estilo de día).
2. Edificios en 3D mediante `fill-extrusion` sobre la capa vectorial de edificios, alturas según disponibilidad de OSM. Los edificios sin altura conocida utilizan una altura de demostración.
3. Calles destacadas mediante doble capa de iluminación ámbar en la propia geometría real de OSM, y luces de ventana/tejado aproximadas sobre edificios cuando el zoom lo permite.
4. Ruta calculada con servidor público OSRM de demostración cuando responde; si falla, línea de conexión aproximada **explícitamente etiquetada**, no simulación engañosa de ruta real.
5. Visualización aérea de todo el trayecto con línea luminosa y puntos de brillo. Ruta **mostrada primero en plano general** durante unos 4,8 segundos.
6. Globo premium editable como SVG, con **PNG original oficial del Ratón Pérez `../perez.png` inalterado** entre las dos capas de cesta SVG. No se le aplica oclusión ni escala 3D que pueda agrandarlo; permanece siempre visible.
7. Cámara sigue la ruta sobre las calles, sin vaivén vertical en el globo; pausa/reanudación, vista general manual, control de magia y órbita final de cuatro perspectivas.
8. La dirección y nombre de clínica pueden configurarse **una sola vez**, persistiendo en `localStorage`. Lee también la configuración de clínica de la demo anterior si existe. Nunca atribuye el origen de demostración a una clínica real.
9. Destino por dirección mediante Photon, basado en datos OSM, o mediante tres destinos públicos de Madrid. Para direcciones particulares, la representación del vuelo termina aproximadamente 170 m antes del portal.
10. Attribution OpenFreeMap/OSM mediante control estándar de MapLibre y nota de procedencia.

## Límites técnicos y de comercialización

- Los edificios de OSM no tienen la misma fidelidad de fachada/tejado que una malla fotogramétrica de Apple o Google. **Aquí prima la ciudad nocturna de cine y el callejero real**, no el hiperrealismo fotográfico.
- La luz nocturna en carreteras y edificios es recreada. Las ventanas no corresponden a luces reales de cada casa.
- Los servidores públicos gratuitos Photon, OSRM y OpenFreeMap no garantizan disponibilidad ni el mismo nivel de servicio necesario para cientos de clínicas. Hay que contratar o alojar proveedores propios antes del lanzamiento comercial. Revisar sus políticas de uso.
- El geocodificador y el motor de rutas reciben las direcciones consultadas. Requiere información adecuada de privacidad y minimización; no publicitar privacidad absoluta.
- La visibilidad real sobre iPhone Safari **aún necesita prueba física**. Las pruebas ejecutadas son de sintaxis, elementos DOM y simulación de flujo.
- La foto de Villa Pérez oficial y el personaje maestro no se regeneran ni reinterpretan.

## Tecnología

- HTML/CSS/JavaScript, sin framework ni servidor propio para el prototipo.
- MapLibre GL JS 5.7.0 y estilos vectoriales de OpenFreeMap.
- OpenStreetMap © colaboradores, licencia ODbL, disponible desde https://www.openstreetmap.org/copyright.
- Rutas de prueba OSRM: https://project-osrm.org/.
- Geocodificación de prueba Photon: https://photon.komoot.io/.
- El globo SVG se compone en `assets/globo-premium.svg` y `assets/cesta-delantera.svg`.
- El personaje oficial se muestra sin alterar en `../perez.png`.

## Próximas mejoras recomendadas

Para llegar a un aspecto aún más próximo a las referencias: usar fuentes de datos de edificios con detalles de tejados, material nocturno 3D propio por fachadas, generador de ventanas por geometría visible, farolas sobre los viales y mejores efectos volumétricos. Todo ello debe mantener la geometría de las calles verificable y no inventar nombres de edificios o direcciones.

Documentación:
- https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/
- https://openfreemap.org/
- https://project-osrm.org/docs/
- https://cloud.google.com/terms/maps-platform/eea
