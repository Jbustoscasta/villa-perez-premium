# Operación Diente Perdido — Villa Pérez v0.7

**Módulo autónomo** de `villa-perez-premium/operacion-diente/` que no modifica el módulo Foto con Pérez. Se puede probar en iPhone por HTTPS:

- Inicio: https://jbustoscasta.github.io/villa-perez-premium/operacion-diente/?v=0.7.0
- Prueba sin datos privados: https://jbustoscasta.github.io/villa-perez-premium/operacion-diente/?demo=1&v=0.7.0

## La película del Ratón (sin minijuegos)

Por decisión expresa de producto, **NO hay retos de tocar estrellas, perseguir objetos ni arrastrar llaves**. Los archivos `magic-adventure.mjs`, `adventure.css` y sus pruebas ya no forman parte del módulo.

1. **Salida de película** (~5,7 s): fachada `../villa-hero.webp` intacta. Luces de ventanas, halo en la puerta y luz que recorre la fachada con SVG/CSS, campanilla opcional y locución: «¡Atención! ¡Ha caído un diente! ¡Preparad la mochila!». Ratón oficial `../perez.png` superpuesto como capa intacta. Transición zoom/blur al mapa real y acceso «Saltar introducción».
2. **Mapa reactivo:** cartografía vectorial real con MapLibre/OpenFreeMap, callejero de contraste alto, edificios 3D donde hay datos, ruta dorada multicapa, partículas sincronizadas con la polilínea, mini huellas, ondas de luz y cinco brillos que siguen posiciones calculadas de la ruta. **Los brillos simulan farolas, no representan inventario real de farolas.**
3. **Sorpresas geográficas:** un lugar público solo se nombra cuando está suficientemente próximo a la ruta, con enfoque de cámara y un mensaje. En otros trayectos, el hito es genérico; no se inventan edificios, puentes o parques.
4. **Brújula mágica:** un único control CIUDAD / RATÓN alterna cámara urbana 3D y cámara baja que sigue la ruta desde atrás. La imagen del personaje no se redibuja ni se convierte en un modelo 3D aproximado.
5. **Llegada secreta:** la ruta infantil se interrumpe antes de los últimos metros de la casa. Desde el 92 % aparece una puerta fantástica, niebla luminosa y una narración; únicamente el adulto confirma finalizar la misión.
6. **Mañana siguiente:** pantalla nocturna con botón voluntario «Guardar la sorpresa para mañana» y previsualización inmediata. Si se guarda, al abrir la misma web en el mismo navegador después de las **06:00 del día siguiente**, aparece «Abrir mi sorpresa de ayer». Se obtiene una postal 1080 × 1350 en PNG, compartible por WhatsApp; las tres estrellas se encienden automáticamente durante el trayecto, sin intervención del niño.

## Sonido

La narración se habilita con un botón de usuario (requisito de Safari), está desactivada inicialmente y utiliza una voz española del sistema **solo para la demo**, no la voz oficial del Ratón Pérez. `config.js` permite configurar clips MP3 oficiales aprobados para intro, depart, halfway, scenic, near y morning. Los efectos de campanilla y el ambiente se sintetizan localmente en WebAudio; existe botón de silencio y se respetan preferencias de movimiento reducido. El audio puede quedar bloqueado si Safari no recibe un gesto explícito.

## Privacidad infantil

- Origen de demostración: Puerta de Alcalá (NO es la dirección real de Clínica del Doctor Abreu). Destino de demostración: Plaza Mayor. Si el servidor de rutas está saturado, se muestra un **trazado ilustrativo declarado como tal**, nunca presentado como ruta peatonal confirmada.
- Para misiones personalizadas, un adulto debe introducir origen y destino. La búsqueda se envía a Photon y las coordenadas a OSRM para obtener una ruta real; estos proveedores externos procesan los datos durante la consulta. No usar servicios públicos comunitarios para producción sin contrato/control de capacidad.
- Las coordenadas, domicilio y polilínea permanecen en la memoria temporal de la página. No se envían a la clínica ni se incluyen en la postal o URL. Para el mapa infantil, se recorta el último tramo de la ruta.
- **Solo cuando se pulsa «Guardar la sorpresa para mañana»** se escribe una ficha mínima en `localStorage`: nombre de clínica, **distancia redondeada a 500 m**, cantidad de estrellas y fechas. No incluye domicilio, coordenadas ni ruta. Se considera caducada después de 15 días. Para una solución real revisar consentimiento, responsabilidad y política de datos.
- La postal exportada usa una ruta decorativa independiente de la geografía privada. No hay notificaciones push ni procesos en segundo plano.

## Tecnología e integración

- `index.html`, `styles.css`, `cinematic-story.css`: interfaz móvil responsive. Los controles están dentro del documento; sin imágenes de pantallas pegadas como fondo.
- `app.js`: orquestación de rutas, cámara, reproducción y ciclo de vida.
- `journey-director.mjs`: audio opcional, tres estrellas pasivas, validación y preparación del recuerdo para la mañana siguiente.
- `premium-map.mjs`: cartografía real coloreada, 3D, trazos luminosos y reacciones ligadas a la ruta.
- `route-utils.mjs`: interpolación de distancia, curva cinematográfica, corte de privacidad y SVG de postal.
- `config.js`: datos de clínica, proveedores de mapa y rutas, referencias a imágenes oficiales.

Para unirlo después con Foto con Pérez: asociar la clínica desde backend verificado, aplicar reglas de suscripción, reutilizar másteres oficiales y enlazar este módulo desde la app existente. No fiarse de datos de clínica pasados en el navegador sin validación.

## Verificaciones y limitaciones

Pruebas puras: `node --test operacion-diente/tests/*.test.mjs`. Cubren privacidad, interpolación, mapas, recuerdos y automatización de estrellas. La sintaxis y correspondencia de IDs se revisan antes de publicar. **Las pruebas de lógica no garantizan la reproducción visual en un Safari físico**; pendiente QA real de iPhone, señal móvil, rotación, rendimiento WebGL y proveedores externos.

Street View **no está integrado**: requiere comprobar permisos, condiciones comerciales y privacidad, especialmente al tratarse de un público infantil. Se recomienda en todo caso solo para lugares públicos y nunca cerca de viviendas.

Atribuciones obligatorias de cartografía: OpenFreeMap / colaboradores OpenStreetMap; MapLibre para renderizado; geocodificación Photon y enrutamiento OSRM en modo de demostración.
