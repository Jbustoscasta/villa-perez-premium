# Villa Pérez · Vuelo nocturno con fotografía aérea real

Webapp de pruebas **independiente** de Foto con Pérez. Ruta animada por las calles entre dos puntos públicos. El vuelo es una recreación; no es seguimiento de una persona ni fotografía nocturna tomada desde un avión.

## Acceso

- https://jbustoscasta.github.io/villa-perez-premium/vuelo-nocturno-lab/?v=4
- Código: `vuelo-nocturno-lab/index.html`

## Modos de mapa — 19 noviembre 2026

1. **Fotografía aérea IGN PNOA (predeterminado, sin token):** ortofotografías oficiales de España (CC BY 4.0) en formato TMS, mostradas como capa ráster sobre el motor MapLibre. El fondo cartográfico vectorial sigue disponible; las fachadas de edificios, cuando se extruyen, son volúmenes gráficos, NO fotogrametría. Estilo nocturno simulado.
2. **Mapa 3D vectorial gratuito:** desmarcar «Fotografía aérea real de España». Motor MapLibre + OpenFreeMap Dark (fallback CARTO), extrusión 3D disponible según cartografía.
3. **Mapbox Standard Satellite:** expandir «Más realismo: fotografía aérea 3D», activar la casilla e introducir un token público de Mapbox con prefijo `pk.`. Se importa Mapbox GL JS v3, con estilo `mapbox://styles/mapbox/standard-satellite`, `lightPreset: night`, ocultación de etiquetas y cámara 3D. Las imágenes satelitales de base son diurnas, con iluminación nocturna recreada. **El token no se sube a GitHub ni se guarda en localStorage.** Restringir token al dominio desde la cuenta de Mapbox. Requiere cuenta y condiciones de facturación de Mapbox.

El TMS PNOA se consume mediante `scheme: 'tms'` (Y invertida) desde `https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg`, con atribución obligatoria a **Ortofotografía PNOA © Instituto Geográfico Nacional (CC BY 4.0)**. Este servicio tiene cobertura para España. Si no responde, los gráficos vectoriales permanecen como respaldo.

## Funciones actuales

- Cálculo de origen y destino mediante Photon; demo predeterminada Puerta del Sol → Plaza de España (Madrid).
- Ruta vial OSRM, interpretada como trayectoria aérea para una historia visual. Si falla OSRM, se muestra una trayectoria recta de respaldo, no una ruta vial confirmada.
- Globo SVG provisional, sin redibujar el Ratón Pérez oficial.
- Cámara suavizada con orientación dinámica, perspectiva inclinada, zoom variable, recorrido luminoso y capítulos de la aventura.
- Pausa, velocidad y repetición.
- Safari iPhone: diseño adaptable, motor MapLibre cargado como **módulo ES** (corrección al error anterior), CDN alternativo.

## Limitaciones y pendientes

- **No es aún una ciudad 3D fotogramétrica nocturna.** Las ortofotos representan el suelo visto desde arriba; los volúmenes de edificios se basan en datos vectoriales OSM cuando estén disponibles. El modo de Mapbox añade mejor aspecto 3D, pero tampoco convierte fotos diurnas en fotos nocturnas captadas de noche.
- No se ha podido validar visualmente este nuevo modo con la red real del IGN en Safari físico desde este entorno; el código JavaScript sí se ha comprobado sintácticamente. El servicio puede ralentizarse o fallar, en cuyo caso usar modo gratuito vectorial.
- El motor Photon y OSRM se usan como servicios públicos de prueba, sin SLA ni garantías para una explotación comercial. Las direcciones escritas se envían a esos servicios externos. **No introducir domicilios de niños** en el prototipo; utilizar destinos públicos.
- Para uso comercial: backend propio/intermediario, privacidad y protección de datos, acuerdos y límites con proveedores, controles de costes y test de prestaciones móviles.
- El globo y la interfaz son provisionales; Ratón Pérez oficial solo como asset maestro intacto o rig aprobado.

## Test manual

1. Abrir enlace HTTPS con Safari actualizado y conexión. Introducir solo direcciones de lugares públicos.
2. Mantener marcada «Fotografía aérea real de España», pulsar «Comenzar el vuelo» y comprobar si se reconocen edificios/tejados reales.
3. Si fallan fotografías IGN, desmarcar y repetir con modo cartográfico (los mapas no se detienen por la ausencia de foto).
4. Opcionalmente comparar con Mapbox a partir de un token público `pk.`.
5. Evaluar fluidez, giros, legibilidad y detalle de barrios antes de la siguiente fase.
