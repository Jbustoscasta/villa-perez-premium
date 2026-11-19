# Google Maps 3D · activación de Villa Pérez

Fecha: 19 de noviembre de 2026.

## Lo más barato: solicitar primero la **Maps Demo Key** de Google

Google ofrece una **clave de demostración gratuita** (sin registrar tarjeta) para cuentas personales elegibles. Su documentación indica que permite cargar mapas 2D y 3D en Maps JavaScript. No sirve para producción; el límite diario es variable.

1. Inicia sesión con una **cuenta personal de Google** (normalmente Gmail). Las cuentas de Google Workspace de empresa no son elegibles para la Demo Key.
2. Abre la página oficial de Google: https://developers.google.com/maps/documentation/javascript/demo-key .
3. Pulsa **Get a Demo Key**, acepta las condiciones y copia la clave mostrada. Ruta directa oficial: https://console.cloud.google.com/google/maps-hosted/tos?ref=https%3A%2F%2Fdevelopers.google.com%2Fmaps%2F .
4. Abre https://jbustoscasta.github.io/villa-perez-premium/google-3d-vuelo/ .
5. Pega la clave en **Google Maps Demo Key o API key web** de esta página (no en el chat ni en una captura). Pulsa **Activar cartografía 3D**.
6. Pulsa **Despegar sobre Madrid** con el ejemplo **Plaza Mayor**, que no necesita geocodificación de direcciones.
7. Comprueba las fachadas, cubiertas y árboles en el centro de Madrid, la fluidez de los giros y que Google muestre datos fotogramétricos y no solo un mapa con el terreno plano.

Si Google no permite obtener una Demo Key con esa cuenta, consulta los pasos para una clave normal más abajo.

## Si no se puede usar Demo Key: Google Maps Platform estándar

Esta fase **requiere intervención del titular de Google Cloud**, especialmente en decisiones de facturación:

1. Accede a https://console.cloud.google.com/ y crea un proyecto nuevo «Villa Perez 3D Pruebas» (nombre sugerido).
2. Vincula una cuenta de facturación después de revisar sus condiciones. No actives servicios que no necesitamos.
3. Habilita **Maps JavaScript API**. Para que los padres escriban direcciones en el campo opcional, habilita también **Geocoding API**.
4. Crea una **API key de navegador** en https://console.cloud.google.com/google/maps-apis/credentials .
5. Restringe la clave con **Application restrictions → Websites (HTTP referrers)** incluyendo el patrón de prueba
   - `https://jbustoscasta.github.io/*`
   Añade tu dominio final solo cuando se despliegue allí.
6. Restringe a **Maps JavaScript API** (y Geocoding API si el proyecto y esta clave lo requieren).
7. Configura alertas presupuestarias en Cloud Billing y cuotas conservadoras de peticiones: las **alertas de gasto no son límites automáticos de gasto**.
8. Copia la clave solo en el campo de la web de pruebas. No la adjuntes por email, mensaje ni la subas al repositorio.

**Importante**: la clave de cliente no es un secreto en el navegador; las restricciones de referente HTTP y APIs son obligatorias para reducir abusos.

## Tarifas orientativas verificadas en noviembre de 2026

Google publica, para el SKU **Immersive Maps**, 5.000 cargas/mes gratuitas y 7 USD por 1.000 cargas adicionales en el primer tramo (si las condiciones aplican a esta modalidad). Hay que distinguirlo del SKU de **Map Tiles API: Photorealistic 3D Tiles**, que no está disponible para cuentas de facturación del EEE. Este prototipo utiliza **Maps JavaScript API 3D**, que Google presenta como alternativa admitida para el EEE.

Fuente: https://developers.google.com/maps/billing-and-pricing/pricing

## Qué hemos construido

- Aplicación aislada de **Foto con Pérez** y de las demás demos.
- Maps JavaScript API con **Map3DElement** en modo `SATELLITE` 3D fotorrealista.
- Pruebas con lugares públicos en Madrid: Puerta de Alcalá → Plaza Mayor, Bernabéu y Arroyo Fresno.
- Viaje 3D con `flyCameraTo` por puntos geográficos. Es una **trayectoria de vuelo ficticia**, no una ruta vial calculada.
- Línea luminosa georreferenciada en `Polyline3DElement`.
- Globo SVG temporal sobrepuesto al mapa. **No es aún un modelo GLB integrado con oclusión física real**. El Ratón Pérez oficial se usa como imagen 2D intacta en la composición y no se redibuja.
- Vista fotorrealista de día; botón crepúsculo con tratamiento de color superpuesto. **No son fotografías nocturnas reales**.
- Geocodificación opcional al pulsar Despegar. Para domicilios personalizados se ocultan los últimos ~180 metros de la trayectoria.
- La clave permanece únicamente en la pestaña mediante `sessionStorage`. No se incluyen domicilios en URL ni se guardan en el servidor.

## Límites y QA que faltan

- No tenemos aún Demo Key ni clave de Maps asociada al titular, por tanto **no hemos validado visualmente Google 3D en un Safari físico**. GitHub Pages correcto y lógica/código no equivalen a haber probado la imagen 3D.
- Mapas 3D en JavaScript tienen cobertura fotogramétrica variable. Verificar el centro y Arroyo Fresno desde el dispositivo.
- El renderizado de modelos grandes puede consumir memoria; Safari iOS debe probarse con batería y red normales, con carga de escena completa.
- La aplicación necesita una integración futura de origen real de cada clínica verificado en backend. Por ahora **Puerta de Alcalá no representa la dirección real de Clínica del Doctor Abreu**.
- Para comercialización infantil: consentimiento y privacidad, revisión jurídica/EEE, revisión de TOS Google y contratos.

Fuentes oficiales:
- Demo Key: https://developers.google.com/maps/documentation/javascript/demo-key
- Maps JS 3D: https://developers.google.com/maps/documentation/javascript/3d/overview
- Cámara animada: https://developers.google.com/maps/documentation/javascript/3d/animate-camera
- Fotogrametría/cobertura: https://developers.google.com/maps/documentation/javascript/3d/coverage
- Restricciones de clave: https://developers.google.com/maps/documentation/javascript/get-api-key
- Cambios de EEE Map Tiles y alternativa JS 3D: https://developers.google.com/maps/comms/eea/map-tiles
