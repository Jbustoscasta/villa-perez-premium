# Operación Diente Perdido · dirección artística v0.4

## Propuesta para diseño, producto y desarrollo
El producto es una **aventura geográfica real**, no un mapa de fantasía. Se muestra una ruta peatonal calculada desde una clínica dental (origen real) hacia el entorno de la vivienda introducida **por una persona adulta**. La app Foto con Pérez no se toca hasta validar este módulo independiente.

### Recorrido en cinco actos
1. **Salida / 4 s:** fachada oficial de Villa Pérez, ventana luminosa y Ratón Pérez oficial como capa inalterada; texto «La puerta se ha abierto…». Botón accesible para saltar. Nada de generar otra versión del personaje.
2. **Despegue / 10 %:** vista inclinada que se acerca a calles reales y avanza lentamente. La ruta empieza a iluminarse.
3. **Viaje / 10–85 %:** cámara con rumbo, pequeñas aceleraciones y frenadas, 3 capas de línea dorada y estela luminosa. Si el mapa tiene edificios vectoriales, activación 3D limitada para móvil. Evitar giros bruscos y zoom de vértigo.
4. **Momento especial / ~50 %:** panel de lugar público verificable **solo** si pasa cerca de la ruta. Sin landmark real, sorpresa genérica. No usar fotografías o panorámicas de terceros sin licencia ni atribución.
5. **Aproximación / 92–100 %:** ocultar escena cartográfica y mostrar transición de bruma, estrellas y puerta. El trazado infantil se ha cortado aproximadamente 160 m antes de casa. CTA «Ver sorpresa final» lleva a recuerdo descargable, sin dirección ni geometría privada.

### Reglas del personaje oficial
- Solo `../perez.png` y recursos oficiales aprobados; nunca recrear, dibujar encima, animar articulaciones o inventar poses.
- Permitido trasladar la **capa completa** (posición, ligera oscilación y escala), sin modificar su identidad ni proporciones.
- Puerta y fachada: imagen intacta `../villa-hero.webp`.

### Sistema visual
- Fondo azul petróleo #071e2b; interfaces verde pizarra #214955; oro #f2d791; crema #fff0c8.
- Overlay y paneles nítidos, jerarquía tipográfica mínima; serif para narración, sans para controles.
- Brillo y partículas: 18 sobre la geometría real, no repartidas aleatoriamente por la ciudad.
- Atrezo artístico solo superpuesto; calles y distancias proceden del mapa real.

### Rendimiento iPhone
- Limitar actualizaciones de posición a ~10 FPS; cámara ~0,7 FPS con interpolación MapLibre.
- MapLibre WebGL y CSS modestos; movimiento reducido sin cámara ni partículas excesivas.
- Sonido opcional y desactivado por defecto, activable mediante gesto.
- Verificar iOS Safari físicamente en Wi-Fi y móvil; orientar y pausar/volver a la app.

### Foto de calle / Street View
**No integrar Google Street View dentro del mapa sin validación contractual.** Para una fase posterior, evaluar 1–2 fotografías panorámicas licenciadas de sitios públicos, lejos de la vivienda, con atribución y caída elegante a solo mapa si no hay cobertura. En ningún caso mostrar el portal residencial.

### No confundir demo con producto
- La clínica «Doctor Abreu» es nombre demostrativo, **no** coincide con el origen turístico provisional (Puerta de Alcalá).
- Las rutas dependen de proveedores comunitarios de prueba; errores no deben disfrazarse como rutas reales.
- No almacenar ni añadir domicilios a analytics, logs, URL o postales.
- El QR y la suscripción serán resueltos en backend antes del lanzamiento.
