# Villa Pérez — Plan A+ · Navegación nocturna fotorrealista

Fecha: 20 de noviembre de 2026.
URL: https://jbustoscasta.github.io/villa-perez-premium/google-3d-vuelo/?v=7.0.0

## Desarrollo

Se mantiene Google Maps JavaScript 3D / Map3DElement en modo SATELLITE. No se crean edificios falsos ni se renderizan las antiguas extrusiones geométricas. Se conservan las formas fotogramétricas de calles, tejados y edificios que el usuario ha aprobado.

1. Noche cinematográfica como vista principal: shader azul de profundidad, atmósfera menos opaca sobre la ciudad, cielo más oscuro, bruma ligera y estrellas ocasionales. Se ha eliminado el bokeh falso de supuestas ventanas ancladas a coordenadas de pantalla.
2. Luminarias urbanas georreferenciadas: nuevo módulo street-night-v7.mjs. Coloca fuentes luminosas discretas junto al recorrido real de Google Routes, cerca de los laterales de la calzada, a aproximadamente cinco metros sobre el suelo.
3. Fantasía discreta cerca de tejados: hasta seis puntos luminosos elevados, georreferenciados respecto a la ruta y con oclusión por la malla de edificios. No se simula que sean ventanas iluminadas reales.
4. El globo y Ratón Pérez oficiales, la estela, la progresión de vuelo y la vista subjetiva 360° se mantienen.
5. Controles independientes: Ver de día desactiva la atmósfera y las luminarias nocturnas. Magia ON/OFF controla las partículas y destellos pero conserva el alumbrado nocturno urbano.
6. Limitación de rendimiento en iPhone: máximo 22 luminarias y seis motas, SVG pequeños y efectos animados limitados a 20 FPS, sin inventar una segunda malla 3D.

## Limitación material

Google SATELLITE no ofrece una noche fotorrealista nativa ni permite acceder directamente a las texturas, materiales o normales de su fotogrametría para reiluminar realmente paredes o ventanas. Los puntos luminosos son una interpretación creativa situada en espacio 3D, NO una modificación física de las fachadas. Para un realismo de película con ventanas encendidas exactamente en cada fachada se necesitaría una malla urbana con materiales editables y los permisos necesarios.

Se conservan las atribuciones y el mapa de Google, sin obtener imágenes del framebuffer ni capturar la fotogrametría.

## Clave y cuotas

Requiere una clave de navegador de Maps JavaScript API / Maps 3D asociada al titular. No se ha incorporado ninguna clave API en el código. Puede introducirse en el formulario web y conservarse temporalmente en la sesión. Restringir por dominio y API; validar facturación, privacidad, cuotas y la disponibilidad de fotogrametría antes del uso comercial.

## Pruebas

- Sintaxis JavaScript, enlaces de módulos y controles DOM revisados.
- Geometría de prueba en Madrid: 17 luces y seis destellos, límite móvil respetado.
- Encendido/apagado por escena y limpieza verificados con dobles de prueba.
- No se ha podido probar la fotogrametría con clave activa ni inspeccionar el resultado real en Safari físico. Pendiente validar iluminación, oclusión de elementos y FPS reales.

## Reversión

Respaldo de GitHub anterior: backup/google-3d-night-before-v7-architecture-lights.
No se ha modificado la publicación demos.ilusiono.com de Hostinger.
