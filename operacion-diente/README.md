# Operación Diente Perdido — módulo Villa Pérez v0.2

Módulo web independiente, **sin tocar el flujo de Foto con Pérez**. Diseñado para alojarse en `villa-perez-premium/operacion-diente/` y reutilizar `../perez.png` (máster oficial intacto) y `../villa-hero.webp` (fachada oficial existente). No se dibuja ni se sustituye el personaje.

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
- Próxima fase: completar postal PNG 1080×1350, biblioteca de frases narrativas, geocoding/routing de producción y pruebas Safari.

## Verificación

`node --test ./tests/*.test.mjs`

Las pruebas automáticas validan geometría, rumbo, partículas en ruta y no divulgación de geometría privada. No verifican que proveedores externos respondan ni Safari real. La conexión externa debe probarse en una web HTTPS desplegada.

## Licencias y atribución

Mapa: © colaboradores de OpenStreetMap. Cliente: MapLibre GL JS. Datos de prueba: OpenFreeMap, Photon, OSRM-FOSSGIS (respetar políticas y atribuciones de cada proveedor).