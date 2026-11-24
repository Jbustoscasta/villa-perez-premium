# La noche de Pérez · Modo padres

Maqueta mobile-first de la experiencia de padres, basada en los seis bocetos visuales aprobados.

## Pantallas
1. Inicio de La noche de Pérez.
2. Destino y recorrido ilustrado desde Villa Pérez.
3. Vídeo del globo en la habitación.
4. Pruebas de visita: foto con Pérez, Pérez en la ventana y huellas.
5. Carta personalizada de Pérez.
6. Cofre de recuerdos y acceso al modo niño.
7. Editor de referencia para las fotografías de selfie y ventana.

## Dirección visual
- Cielo azul noche con estrellas y luz de luna.
- Placa de marca y controles circulares en metal dorado.
- Botones esmaltados turquesa y granate.
- Tarjetas de pergamino con filetes dorados.
- Recursos existentes del proyecto: Ratón Pérez en su globo, Villa Pérez y dormitorio infantil.

## Comportamiento implementado
- Navegación entre pantallas, menú y ayuda.
- Campo de dirección con uso temporal en memoria (no se persiste).
- Enlace al editor de vídeo existente en la ruta vuelo-magico.
- Enlace al editor de huellas existente en la ruta huellas-perez.
- Selección de foto y guardado local de borradores comprimidos.
- Carta personalizable con vista previa y guardado local.
- Cofre que reúne los borradores de carta y fotografía en el navegador actual.
- Acceso al modo niño actual en la ruta camara-espia.

## Límites de esta fase
- El mapa es una ilustración de diseño, no una ruta geocodificada.
- El editor de fotos guarda una referencia, todavía no compone/exporta la fotografía final con Pérez.
- El editor de vídeo y las huellas aún no publican sus resultados en el Cofre.
- El Cofre es local al navegador/dispositivo; todavía no sincroniza con el modo niño.
- Los recuerdos se muestran como borradores y no se activan automáticamente para el niño.
- La versión actual de modo-padres no se ha sustituido.

La siguiente fase será conectar cada editor al modelo unificado del Cofre y después implementar sincronización privada con el modo niño.
