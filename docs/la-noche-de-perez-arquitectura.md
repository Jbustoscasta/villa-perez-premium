# La noche de Pérez — arquitectura de experiencia

**Estado:** fase de arquitectura y prototipo navegable.  
**Destino previsto:** la ruta /modo-padres/ seguirá siendo la entrada para adultos; esta propuesta se prueba de forma aislada en /la-noche-de-perez/. No sustituye todavía la versión publicada.

## 1. Principios de producto

1. Mobile-first y vertical: cada pantalla ocupa el viewport disponible (100dvh), respeta las safe areas y evita el scroll de página.
2. Una tarea por pantalla, una acción principal y un botón claro para volver. Los ajustes secundarios viven dentro de la tarea, no en el inicio.
3. El padre puede seguir el recorrido recomendado o entrar directamente en cualquier utilidad. Ninguna creación es obligatoria.
4. Las herramientas generan elementos independientes que se reúnen en un único Cofre de recuerdos.
5. El modo niño es otra experiencia, sin navegación ni enlaces visibles al modo padres.
6. No se inventan resultados: los mapas, montajes y recuerdos solo se muestran como reales cuando el motor correspondiente los ha generado.

## 2. Mapa de navegación

QR → Bienvenida / Inicio de padres
- Preparar la visita (recorrido guiado, siempre saltable)
  - 1. Destino y vuelo en el mapa
  - 2. Vídeo del globo en la habitación
  - 3. Pruebas de la visita
    - Selfie de Pérez con el niño dormido
    - Pérez volando junto a la ventana
    - Huellas en un detalle del dormitorio
  - 4. Carta personalizada
  - 5. Revisar el cofre y activar modo niño
- Accesos directos: Vídeo del globo, Pruebas de la visita, Carta de Pérez y Cofre de recuerdos
- Activar modo niño → Cámara Mágica / Galería infantil

## 3. Pantallas y jerarquía

### A. Inicio de padres
- Fondo cinematográfico a pantalla completa: Pérez sobrevolando una ciudad de noche.
- Marca: La noche de Pérez.
- Acción dominante: Preparar la visita.
- Accesos compactos: Vídeo del globo, Pruebas de la visita, Carta de Pérez y Cofre de recuerdos.
- Acción persistente inferior: Activar modo niño.
- Ayuda contextual en un botón ?; nunca una página de instrucciones larga.

### B. Destino y vuelo cartográfico
- Campo de dirección y confirmación explícita del destino.
- Mapa real solo después de geocodificar y validar una coincidencia inequívoca.
- El mapa infantil debe terminar antes del domicilio y no mostrar número, coordenadas ni último tramo.
- La dirección se mantiene en memoria temporal para calcular la ruta; no se guarda en el Cofre ni en el registro infantil.
- El origen de Villa Pérez debe configurarse como un punto ficticio aprobado. No reutilizar el origen de demostración de Puerta de Alcalá ni el origen de una clínica.

### C. Vídeo del globo en la habitación
- Reutiliza el editor existente en vuelo-magico/.
- Flujo: hacer/elegir foto → revisar encuadre → ajustar recorrido del globo → previsualizar → exportar → guardar en el Cofre.
- Los controles del editor no deben aparecer en la grabación final.

### D. Pruebas de la visita
Tres opciones separadas:
1. Selfie con Pérez: foto del niño dormido y composición con el máster oficial del personaje.
2. Pérez en la ventana: foto realista desde la habitación hacia el exterior y globo superpuesto.
3. Huellas de Pérez: foto de detalle (almohada, mesita, etc.) y editor simple de huellas normales, invertidas o mágicas.

Cada editor debe tener su propio asistente, controles mínimos y resultado revisable antes de guardar.

### E. Carta de Pérez
- Nombre del niño, diente perdido y mensaje editable con texto inicial sugerido.
- Vista previa antes de guardar.
- Se almacena como un elemento más del Cofre; no requiere haber creado un vídeo.

### F. Cofre de recuerdos
- Biblioteca única con tarjetas de vídeo, fotografía, huellas, carta y postal del recorrido.
- Estado por elemento: borrador, preparado para mañana o disponible.
- El adulto puede revisar, sustituir o eliminar un elemento.
- Activación del modo niño desde aquí y desde el inicio.
- El niño ve solo los elementos publicados para él, nunca herramientas de edición, dirección ni metadatos privados.

### G. Modo niño
- Reutiliza el lenguaje visual de la Cámara Mágica, pero evoluciona de un único vídeo a una galería de varios recuerdos.
- No debe incluir un botón visible «Modo padres».
- Para volver al área adulta se define una puerta de padres protegida (gesto discreto más verificación adulta/PIN); no confiar únicamente en ocultar un enlace como medida de seguridad.

## 4. Modelo de datos del Cofre

El modelo actual de Cámara Mágica guarda una única clave captura-magica y exige que exista un vídeo para considerar la sorpresa disponible. Eso no cubre el nuevo producto: una carta, una foto o unas huellas deben poder publicarse por separado.

Modelo objetivo:

- Mission: id, createdAt, childAvailableAt, items[].
- MemoryItem: id, type, title, createdAt, availableAt, status, mimeType, blobRef, previewRef, metadata.
- Tipos: flight-video, perez-selfie, window-balloon, footprints, letter y route-postcard.
- Estados: draft, scheduled y available.

Reglas:
- Cada elemento tiene su propia disponibilidad; no se exige vídeo para mostrar una carta o fotografía.
- La primera maqueta puede usar IndexedDB en el mismo dispositivo.
- Para que el niño acceda desde otro móvil/tablet se necesita almacenamiento privado sincronizado y un vínculo familiar/código de acceso. IndexedDB no sincroniza entre dispositivos.
- La dirección, coordenadas y ruta completa no se copian a los elementos infantiles.
- Los archivos se guardan una sola vez; la galería solo mantiene referencias y metadatos.

## 5. Integración con los módulos existentes

| Módulo | Papel en la nueva experiencia | Trabajo pendiente |
|---|---|---|
| vuelo-magico/ | Editor de vídeo del globo en la habitación | Publicar su resultado como elemento independiente del Cofre |
| operacion-diente/ | Motor cartográfico y secuencia del viaje | Sustituir origen de clínica/demo por origen ficticio aprobado de Villa Pérez; conectar desde el nuevo flujo |
| huellas-perez/ | Editor de huellas | Devolver el PNG al Cofre, además de permitir descargarlo |
| camara-espia/ | Experiencia infantil | Leer múltiples elementos del Cofre, no solo un vídeo obligatorio |
| foto-premium.html | Experiencia B2B de Foto con Pérez (palma/hombro) | No reutilizar como selfie del niño dormido; son casos de uso diferentes |

**Limitación cartográfica actual:** operacion-diente/config.js todavía usa Puerta de Alcalá como origen de demostración y servicios comunitarios de geocodificación/rutas. No debe presentarse como el recorrido real de Villa Pérez hasta configurar el origen y un proveedor adecuado para producción.

## 6. Sistema visual y comportamiento responsive

- Mantener la estética aprobada: azul noche, luz cálida, oro suave, tipografía serif en titulares y paneles oscuros translúcidos.
- El arte de Pérez y del globo se reutiliza intacto; no redibujar el máster.
- Pantallas operativas: controles HTML reales superpuestos a la escena, nunca texto importante incrustado en una imagen.
- Base: height: 100dvh, overflow: hidden, safe areas y tamaños fluidos.
- Scroll de página desactivado. Solo se permite scroll interno en una lista larga, una carta extensa o un diálogo de ayuda.
- Adaptación prioritaria a 375×667, 390×844 y 430×932; tablet y escritorio usan el mismo sistema, con un escenario centrado y más aire.
- Pedir permiso de cámara únicamente después de que el adulto pulse «Hacer foto».

## 7. Plan por fases

### Fase 1 — Arquitectura y prototipo navegable
- Definir mapa de pantallas, jerarquía, textos, navegación y estados.
- Construir inicio vertical, pantallas de destino, vídeo, pruebas, carta y cofre.
- Mantener la versión publicada actual sin sustituirla hasta validar el prototipo.

### Fase 2 — Integración de herramientas
- Conectar destino con el motor cartográfico y definir el origen ficticio de Villa Pérez.
- Conectar editor de vídeo y editor de huellas con el Cofre.
- Construir los compositores de selfie y ventana.
- Construir la carta final y su exportación.

### Fase 3 — Cofre unificado y modo niño
- Sustituir la captura única por una biblioteca de elementos.
- Mostrar fotos, vídeos, huellas, carta y postal de forma independiente.
- Programar disponibilidad para la mañana siguiente.
- Definir sincronización privada si el niño utilizará otro dispositivo.

### Fase 4 — QA y publicación
- Pruebas de navegación y viewport en Safari iPhone y Chrome Android.
- Pruebas de cámara permitida/denegada, galería, exportación, memoria y recuperación.
- Comprobar que ningún dato de domicilio llega al modo niño.
- Publicar el nuevo inicio en la ruta QR solo después de aprobar la revisión visual y funcional.

## 8. Decisiones pendientes, no bloqueantes para el prototipo
- Coordenadas/origen ficticio definitivo de Villa Pérez.
- Si el niño verá los recuerdos en el mismo dispositivo o en otro.
- Hora exacta de apertura del Cofre por la mañana.
- Definición de la funcionalidad número 5, que todavía no se ha especificado.
