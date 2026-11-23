# Cámara Espía de Pérez — Villa Pérez

Una webapp **híbrida, 90% imagen** que reproduce sin redibujar la ilustración original aprobada: logotipo, castillo, marcos, ratón explorador, botones, panel de alerta, luna, globo, etc. Una imagen optimizada `assets/poster.webp` es toda la maqueta. El código sirve solo para la cámara de prueba, cronómetro, activación nocturna, alerta dinámica y reproducción de contenidos preparados por el adulto.

## Iniciar

Publicar la carpeta en una URL **HTTPS**, sin instalación. Abrir `index.html` desde Safari de iPhone. La cámara real requiere un permiso explícito; si no se concede, aparece el visor nocturno ilustrado, y la misión simulada funciona igualmente. No se graba vídeo real durante la noche. El tiempo es una simulación y puede continuar en almacenamiento local al volver a abrir la página. El móvil no garantiza mantener la pantalla despierta toda la noche ni disponer de batería.

## Estados del recuadro «Alerta mágica»

- Inicial: texto exacto **«Aquí se almacenará la grabación.»** y botón `Ver` con `display:none`.
- Preparado por el adulto: **«La cámara ha captado algo...»** y botón **Ver** visible.
- El botón abre un cofre con el vídeo preparado; **foto** y **carta** solo aparecen si el adulto las ha añadido.

La condición de disponibilidad viene del repositorio local **IndexedDB**, nunca de un temporizador simulado ni de un radar ficticio. La app del adulto, en **la misma origin** del navegador, podrá invocar:

```javascript
await window.VillaPerezSpy.publishCapture({
  videoBlob: blobDelVideoPreparado,
  photoBlob: fotoOpcional,   // omitir si no contratada
  letterBlob: cartaOpcional, // omitir si no contratada
  availableAt: Date.now()   // o fecha/hora prevista, p. ej. mañana 07:00
});
```

Si el editor del padre está en otra página pero mismo dominio, puede escribir al mismo IndexedDB (`villa-perez-sorpresas-v1`, object store `items`, clave `captura-magica`). También está implementada señalización entre pestañas por `localStorage` (`vp_cam_espia_capture_changed_v1`). No incluye subida a un servidor; para compartir entre móviles diferentes hará falta un almacenamiento seguro del backend más adelante.

## Vistas de prueba (no crean resultados reales)

- `?demo=empty` fuerza la alerta vacía.
- `?demo=ready` muestra la alerta completa, con un vídeo ilustrativo local para pruebas.

## Archivos

- `assets/poster.webp`: diseño original con solo el texto del aviso borrado, para que sea dinámico. Conserva toda la ilustración restante.
- `assets/habitacion-original.webp`: imagen de muestra que se ve si la cámara no está autorizada.
- `assets/demo-captura.mp4`: breve simulación de muestra para probar `Ver`; no se entrega como vídeo real.
- `index.html`, `styles.css`, `app.js`: puntos interactivos precisos sobre el póster.

## Privacidad y seguridad

- Esta interfaz **no graba** durante toda la noche ni promete detectar movimiento real.
- No se transmiten fotos ni sonido al servidor.
- El acceso a cámara se solicita solo cuando el niño inicia una misión, con permisos nativos.
- No guardar el móvil bajo una almohada ni mantenerlo sobre ropa de cama mientras carga. En Safari iPhone, el bloqueo o suspensión puede interrumpir la vista de cámara, aunque el contador se recupere al volver a abrir la página.
- La publicación del padre en IndexedDB solo funciona en el **mismo navegador y origen**; para permitir acceso desde otros teléfonos habrá que implementar una cuenta/enlace privado y backend de almacenamiento.
