# Operación Diente Perdido — módulo Villa Pérez v0.5 · MAPA PREMIUM (calles legibles y luz dinámica)

## Demo pública para iPhone — 19 noviembre 2026

**URL:** https://jbustoscasta.github.io/villa-perez-premium/operacion-diente/

**Enlace de acceso directo:** https://jbustoscasta.github.io/villa-perez-premium/operacion-diente/?demo=1

El botón «Probar recorrido de Madrid» selecciona dos lugares públicos (Puerta de Alcalá → Plaza Mayor) sin pedir dirección familiar. Intenta obtener una ruta peatonal calculada por el servicio OSM. Si este servidor público falla, muestra una **ruta ilustrativa explícitamente marcada como no verificada** para que se pueda evaluar la interfaz. La animación empieza al terminar de cargar el mapa. La opción «¡Se me ha caído un diente!» permite probar otras direcciones reales mediante el formulario para adultos.

**Límites de la demo:** la dirección real de Clínica del Doctor Abreu NO está configurada; los servicios comunitarios pueden limitar peticiones. La prueba en Safari físico y la accesibilidad de GitHub Pages deben comprobarse externamente. No es un servicio de producción.

Módulo web independiente, **sin tocar el flujo de Foto con Pérez**. Diseñado para alojarse en `villa-perez-premium/operacion-diente/` y reutilizar `../perez.png` (máster oficial intacto) y `../villa-hero.webp` (fachada oficial existente). No se dibuja ni se sustituye el personaje.

## Mejoras visibles de cartografía y efectos — v0.5

- **BASE VECTORIAL CAMBIADA:** OpenFreeMap Liberty en vez de Dark Matter; se aplica después del evento de carga una paleta nocturna propia sobre los elementos geográficos REALES.
- **CALLES Y NOMBRES:** vías principales en crema luminosa, secundarias en azul perla, caminos en verde azulado, calles y lugares con textos claros y halo oscuro para leerlos en el iPhone. Agua azul vivo y parques verde petróleo. Menor oscurecimiento por el degradado UI que tapaba calles.
- **EDIFICIOS 3D REALES:** capas vectoriales `building` de OpenFreeMap con `render_height`, extrusión progresiva de z14.3 a z15.4, colores de edificio dependientes de altura y etiquetas dibujadas encima. La disponibilidad depende de la zona y la cartografía.
- **RUTA LUMINOSA:** camino con línea central blanca crema de 6.2 px, segundo halo ámbar 17 px, resplandor difuminado de 34 px y sombra de alto contraste 24 px; diferencia claramente tramo pendiente y tramo recorrido.
- **PARTÍCULAS EN PANTALLA:** capa Canvas independiente sobre el mapa con 24 destellos proyectados con MapLibre sobre la geometría REAL, estrellas y una pequeña onda viajera. Canvas a DPR máximo 1.7 con actualizaciones a ~22 FPS; desactivado si se solicita reducir movimiento.
- **CÁMARA:** zoom dinámico próximo a 16.15 (antes 15.15) para ver mejor cada calle. La interfaz permite volver a ver la ruta completa.
- **SIN INTERFERIR EN FOTO CON PÉREZ:** esta carpeta tiene `premium-map.mjs` como único motor nuevo, integrado en `app.js`, sin tocar `../index.html` ni assets oficiales.
- **COMPROBACIÓN:** 17 pruebas de geometría, privacidad y estilo/effects, sintaxis JS y concordancia de controles. Sin afirmaciones de validación visual de iPhone/Safari, falta QA en dispositivo.

**Acceso demo:** https://jbustoscasta.github.io/villa-perez-premium/operacion-diente/?demo=1&v=0.5.0

## Novedades v0.4 — experiencia premium

- **Acto de salida:** superposición animada de la fachada **oficial** `../villa-hero.webp` y el personaje **original intacto** `../perez.png`. Opción «Saltar introducción».
- **Ritmo cinematográfico:** interpolación de avance con ocho hitos de ritmo suave, frenadas y aceleraciones. Inversa de la curva para pausa, reanudación y cambios de duración sin saltos.
- **Mapa nocturno premium:** tres capas de ruta dorada con halo, 18 partículas sincronizadas con la geometría real, edificios extruidos opcionales (si el proveedor aporta vector buildings), perspectiva dinámica y giros por rumbo verdadero. Botones de visión general y vista cinematográfica.
- **Postal del camino:** parada visual que menciona **solamente** un punto público si la ruta pasa a menos de 120 m según coordenadas. En otros recorridos se muestra una sorpresa genérica, sin inventar monumentos. Las imágenes de Street View **no** forman parte de esta versión.
- **Llegada:** escena nocturna de cierre que se activa a partir del 92 % del viaje.
- **Privacidad reforzada:** en la misión personalizada, el mapa del niño reproduce solo las calles calculadas hasta unos 160 m antes del domicilio. La distancia total real se mantiene para la información de padres, y la postal usa únicamente un camino decorativo.
- **Sonido:** dos tonos cortos originales y opcionales, desactivados por defecto; compatibles con silencio y preferencias de movimiento reducido.
- **Pruebas:** 13 pruebas lógicas aprobadas en comprobación de código; sintaxis JS y correspondencia de IDs de controles verificadas. **No sustituye una QA física de Safari ni validación del servicio cartográfico.**

### Street View

**No integrado todavía.** Google Street View tiene condiciones específicas de visualización y combinación con mapas en el Espacio Económico Europeo; la aplicación está dirigida a niños. Antes de añadir panorámicas, evaluar un proveedor y contrato adecuado (con atribución, privacidad, derechos de uso y cobertura), y limitarlo a lugares públicos lejos de domicilios.

## Qué hace ya

- Pantalla de bienvenida personalizada con nombre de clínica.
- Zona para padres: origen de clínica editable y domicilio mediante selección de sugerencia de dirección.
- Geocodificación Photon (OSM) y **ruta real a pie** a través del servidor de pruebas FOSSGIS OSRM.
- Mapa real interactivo con MapLibre + OpenFreeMap (tema oscuro); línea dorada de progreso a lo largo de geometría real.
- Posición interpolada sobre la ruta por distancia, controles iniciar/pausar/continuar/ver todo/seguir, dos ritmos.
- **NUEVO v0.2:** estela de 13 partículas geolocalizadas sobre la ruta de verdad, vista cinematográfica con orientación según el tramo, seguimiento suave (sin saltos de cámara cada 90 ms), hitos visuales de salida/en camino/cerca/llegada y accesibilidad mejorada.
- **Corrección de privacidad v0.2:** la postal es puramente decorativa y NUNCA reproduce la forma geográfica de la ruta, que podría dar pistas sobre la vivienda. Test explícito contra filtraciones.
- **Robustez:** las búsquedas de direcciones invalidan peticiones obsoletas incluso al borrar el texto; los fallos al cargar el mapa dejan reintentar.
- Mensajes de misión, final controlado por adulto y postal descargable como SVG sin datos del domicilio.
- No usa cookies, analítica ni almacenamiento local. El domicilio se mantiene solo en memoria de la pestaña mientras dura el viaje.
- Responsive móvil (iPhone Safari por comprobar in situ).

## Arranque

Si se añade al repo existente (recomendado para respetar recursos compartidos):

`https://jbustoscasta.github.io/villa-perez-premium/operacion-diente/`

O para desarrollo local, desde la **raíz del repo que contiene `perez.png` y `villa-hero.webp`**:

```bash
python3 -m http.server 8080
# abrir http://localhost:8080/operacion-diente/
```

Para usar el ZIP aislado crea una carpeta superior con `perez.png` y `villa-hero.webp` originales sin modificarlos, o ajusta en `config.js` las rutas `assets` a las copias aprobadas. Sin estos recursos se muestra el mapa y un indicador genérico, no un Ratón Pérez reimaginado.

## Demo de clínica — ¡importante!

«Clínica del Doctor Abreu» aparece **solo como nombre demostrativo**. Su ubicación real **NO se conoce**: la demo inicia en **Puerta de Alcalá, Madrid**, claramente indicada como «origen de prueba». Selecciona una dirección real de clínica en el formulario antes de calcular el recorrido definitivo. **No atribuir la localización de la demo a la clínica.**

## Servicios externos / requisitos antes de lanzar a clientes

`config.js` apunta a **servidores públicos de demostración**: `photon.komoot.io`, `routing.openstreetmap.de` y `tiles.openfreemap.org`. En esta fase hay límites de capacidad, políticas de uso, errores posibles de CORS y sin SLA. **No usarlos para atender familias de producción ni para uso comercial sostenido sin contratación / autorización / infraestructura.** Reemplazar por servicios propios o comerciales con geocodificador y enrutador peatonal, proxy servidor, cuotas y auditoría de condiciones. El mapa exige conexión a Internet.

**Privacidad:** el domicilio que escribe el adulto se envía al geocodificador, y las coordenadas a enrutamiento y mapas. No se almacena en servidores de Ilusiono desde este frontend, pero sí se procesa por servicios externos: requiere evaluación legal, acuerdos y medidas adecuadas antes del lanzamiento. No mostrar dirección al niño, a la clínica, en postal ni en analítica. Evitar parámetros de URL con direcciones o coordenadas.

**Seguridad / control comercial:** la clínica y su estado de suscripción deben proceder de backend verificado (no confiar en `config.js` editable o query strings); definir cancelación y fallback a Ilusiono antes de unirlo al QR comercial.

## Integración prevista

- Carpeta `operacion-diente/` con HTML/CSS/JS independiente, enlazada desde portada Foto con Pérez con botón «¡Se me ha caído un diente!».
- Reusar nombre/origen desde `clinic` verificado por backend (p.ej. `clinic_id` asociado a tarjeta/QR), nunca tomar dirección de origen de un texto no validado.
- Reusar archivos `../perez.png` y `../villa-hero.webp` sin procesarlos.
- Mostrar la experiencia solo con suscripción activa o modo gratuito Ilusiono según reglas de negocio.
- Capa opcional de mensajes de voz con asset ElevenLabs ya aprobado; no integrado aquí.
- Próxima fase: versión PNG de postal, voces narrativas, geocoding/routing de producción, QA Safari y posible vista panorámica licenciada.

## Verificación

`node --test ./tests/*.test.mjs`

Las pruebas automáticas validan geometría, rumbo, partículas en ruta y no divulgación de geometría privada. No verifican que proveedores externos respondan ni Safari real. La conexión externa debe probarse en una web HTTPS desplegada. Los servicios de demo comunitarios pueden limitar las solicitudes.

## Licencias y atribución

Mapa: © colaboradores de OpenStreetMap. Cliente: MapLibre GL JS. Datos de prueba: OpenFreeMap, Photon, OSRM-FOSSGIS (respetar políticas y atribuciones de cada proveedor).