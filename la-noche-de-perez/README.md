# La noche de Pérez · Modo padres

Maqueta responsive de la experiencia de padres. La interfaz se mantiene aislada en \`/la-noche-de-perez/\`; no sustituye la entrada actual \`/modo-padres/\`.

## Pantallas
1. Inicio con el arte nocturno original de Villa Pérez.
2. Destino (sin dibujar rutas ficticias; el mapa real requiere configurar el origen oficial).
3. Vídeo del globo, conectado al editor existente de \`/vuelo-magico/\`.
4. Pruebas de visita: foto con Pérez, Pérez en la ventana y huellas.
5. Carta personalizada.
6. Cofre de recuerdos.

## Integraciones
- Foto elegida en el paso de vídeo: se entrega al editor mediante el almacén IndexedDB existente \`VPPhotoStore\`.
- Vídeo exportado: se guarda también en el Cofre mediante \`LNPMemoryStore\`.
- Huellas: el editor existente recibe el flujo desde esta aplicación, carga la foto compartida si existe y devuelve el PNG al Cofre.
- Fotos compuestas y cartas: se guardan en IndexedDB, no como cadenas base64 en \`localStorage\`.
- Activación de Cámara Mágica: el editor de vuelo puede adjuntar el vídeo y los recuerdos más recientes de foto/carta a la misión infantil existente.
- El Cofre permite revisar y eliminar recuerdos.

## Límites explícitos
- El mapa real no se muestra hasta fijar el punto de partida oficial de Villa Pérez y validar el destino; no se usa la ubicación de demostración de Puerta de Alcalá.
- El editor de composición usa intacto el máster disponible del globo y permite moverlo y escalarlo; no redibuja al personaje.
- El Cofre usa almacenamiento local del mismo navegador/dispositivo. No es sincronización entre móviles.
- La Cámara Mágica actual acepta un vídeo, una fotografía y una carta como extras; todavía no es una galería infantil multi-recuerdo.
- La ruta de dirección es temporal y no se persiste ni se copia a la experiencia infantil.

## Diseño
Azul noche, luz cálida, oro suave, titulares serif y paneles oscuros translúcidos. El escenario utiliza \`modo-padres/assets/noche-villa-perez.webp\`, el máster \`vuelo-magico/assets/perez-globo-iphone.webp\` y la fotografía nocturna original de dormitorio. Las pantallas ocupan el viewport y evitan el scroll de página; el scroll se limita a la lista del Cofre cuando sea necesario.
