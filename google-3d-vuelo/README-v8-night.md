# Villa Pérez · Plan A+ noche cinematográfica v8

Fecha: 20 noviembre 2026

## Comparación

El modo fotorrealista de Google Maps 3D (SATELLITE) solo dispone de imagery diurno. La API NO ofrece noche nativa para SATELLITE. El objetivo v8 es que el cambio visual sea evidente sin perder las geometrías 3D reales, sin cambiar edificios ni ocultar sus créditos.

El render nocturno anterior utilizaba una segunda instancia WebGL con un oscurecimiento bajo. La v8 utiliza una capa atmosférica Canvas2D transparente, sin otro contexto WebGL, con exposición azul marino entre 0,66 y 0,82 de opacidad según la zona. No usa filtros que editen la fotogrametría de Google y deja el área de créditos fuera del lienzo.

Los efectos geográficos siguen siendo adicionales, no iluminación física de fachadas: el módulo street-night-v7.mjs sitúa hasta 30 farolas virtuales de luz cálida junto a la ruta, y hasta 8 brillos de fantasía que se sitúan hasta 3 metros por encima de la superficie 3D mediante RELATIVE_TO_MESH. Los marcadores usan oclusión nativa. Se carga una vista preliminar de luces al conectar el mapa, sin necesidad de iniciar el vuelo, para comparar claramente día/noche.

Modo día desactiva la gradación y las luminarias, mientras que Magia OFF deja el alumbrado urbano, pero desactiva los destellos adicionales.

## Límites reales

No es un mapa nocturno real: Google Maps 3D fotográfico sigue suministrando escenas diurnas, y esta capa no puede recolorear físicamente las texturas de cada edificio ni encender sus ventanas. El resultado sigue siendo una recreación nocturna artística, con sus límites. Para conseguir fachadas realmente iluminadas y sombras físicas habría que usar una malla urbana editable y disponer de sus licencias.

## Revisión

- Probada sintaxis JavaScript de app.mjs, night-cinema-v8.mjs, street-night-v7.mjs.
- Probado Canvas2D en un entorno simulado: al activar noche muestra gradiente oscuro intenso; al cambiar a día queda oculto.
- Test de geolocalización y geometría con ruta de Madrid: 24 puntos cálidos y 7 brillos anclados a malla, coordenadas finitas y recuento acotado.
- IDs del HTML comprobados contra referencias del código. Clave Google no incorporada al repositorio.
- Pendiente comprobación en iPhone Safari físico con Google Maps 3D cargado y API key válida. Estas pruebas no demuestran realismo nocturno en el dispositivo.

Copia de seguridad: backup/google-3d-before-night-v8.
Despliegue: https://jbustoscasta.github.io/villa-perez-premium/google-3d-vuelo/?v=8.0.0

No se ha tocado demos.ilusiono.com.
