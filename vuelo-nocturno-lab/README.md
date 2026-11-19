# Villa Pérez — Vuelo nocturno 3D (prototipo)

Un test interactivo mobile-first de *En busca del diente perdido*. Diseñado para probar un vuelo desde una clínica (origen preconfigurable) a una ubicación que el padre indique.

## Qué funciona
- Mapa vectorial nocturno con OpenFreeMap y MapLibre GL JS, con extrusión de edificios 3D cuando el estilo y sus datos lo permiten.
- Geocodificación de direcciones a través del servicio público de demostración Photon.
- Cálculo de una **ruta vial** mediante OSRM, usado como base para una recreación **aérea** (no para navegación ni vuelo real); respaldo de trayectoria directa si OSRM falla.
- Animación de cámara siguiendo la ruta, globo aerostático de prueba, ruta luminosa y narrativa infantil de cuatro capítulos.
- Interfaz adaptable para Safari iPhone, pausa/repetición y velocidades de vuelo.
- Demo sin claves API: origen `Puerta del Sol, Madrid`, destino `Plaza de España, Madrid`.

## Corrección de compatibilidad — 19/11/2026
La primera versión apuntaba erróneamente a `dist/maplibre-gl.js` de MapLibre v6, archivo clásico que **ya no existe** en dicha versión. Se ha sustituido por `dist/maplibre-gl.mjs` mediante importación ES module, con dos CDNs y dos estilos cartográficos alternativos. Verificados en un ensayo de navegador con servicios simulados (flujo de vuelo y fallbacks); **no se ha verificado la descarga real de servicios externos desde Safari**.

## Cómo probar
1. Publicar el contenido de la carpeta en un hosting HTTPS estático (por ejemplo, GitHub Pages) o abrir `index.html` en un navegador con conexión. Para pruebas locales con rutas relativas, ejecutar `python3 -m http.server 8000` y abrir `http://localhost:8000`.
2. Pulsar **Comenzar el vuelo**.
3. Para personalizar, cambiar el destino por una dirección **pública**; abrir «Cambiar origen» para poner la clínica de prueba.
4. En Safari iPhone, mantener la pantalla en primer plano mientras se reproduce la animación.

## Dependencias externas
- MapLibre GL JS 6.19.0 en formato ES module (`maplibre-gl.mjs`), con CDN principal jsDelivr y respaldo unpkg
- OpenFreeMap https://openfreemap.org/ (estilo `dark`); respaldo CARTO Dark Matter si falla el mapa
- Photon demo https://photon.komoot.io/
- OSRM demo https://router.project-osrm.org/
- Datos © OpenStreetMap contributors, OpenMapTiles, OpenFreeMap.

**Muy importante:** estos endpoints públicos gratuitos son adecuados para prototipos y pruebas de carga reducida, **no** constituyen garantías de disponibilidad ni son un backend comercial listo para producción. Ver condiciones y límites de uso de cada proveedor.

## Protección de menores / privacidad
No introducir domicilios de niños en este prototipo. El destino que se escribe se transmite directamente al geocodificador Photon; las coordenadas de origen y destino se transmiten a OSRM. No se almacenan direcciones en el almacenamiento del navegador ni se añaden a la URL. Para producción, usar un backend intermediario con controles de acceso, acuerdos de tratamiento apropiados, minimización de datos, retención definida y consentimiento/información legal correspondientes.

## Límites visuales
Este prototipo **NO** usa imágenes fotográficas nocturnas reales ni Google Photorealistic 3D Tiles. Usa datos de mapas vectoriales con edificios 3D donde haya alturas disponibles. El globo es un SVG provisional y **no contiene ni reinterpreta el Ratón Pérez oficial**. El personaje oficial se incorporará solo mediante el archivo maestro/rig autorizado.

## Siguiente fase (después de validar el test)
- Cámara aérea suave con interpolación de curvas de trayectoria y mejores encuadres a la altura del barrio.
- Prueba A/B con cartografía satelital/3D fotogramétrica en plataformas habilitadas en España.
- Fachada Villa Pérez y globo definitivo como assets artísticos aprobados.
- Servicio propio de geocodificación y rutas, mejor privacidad y fiabilidad.
- Pruebas reales de rendimiento y compatibilidad en Safari iPhone (no se han ejecutado desde este entorno).