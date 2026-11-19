# Villa Pérez Premium — Foto con Pérez

Versión estática preparada para GitHub Pages, Netlify o Cloudflare Pages.
Incluye el Ratón Pérez oficial sin modificar, cámara HTTPS, detección de palma y hombro, edición táctil y exportaciones.

## Publicar en GitHub Pages
1. Crea un repositorio, preferiblemente llamado `villa-perez-premium`.
2. Sube el contenido de este ZIP a la raíz del repositorio (no el archivo ZIP sin descomprimir).
3. En GitHub abre Settings > Pages > Build and deployment > Deploy from a branch.
4. Selecciona la rama `main` y la carpeta `/(root)`. Guarda.
5. Visita `https://TU-USUARIO.github.io/villa-perez-premium/`.
6. Prueba en Safari de iPhone con permisos de cámara. Se requiere HTTPS y conexión para MediaPipe.

Parámetros opcionales: `?clinica=Cl%C3%ADnica%20del%20Doctor%20Abreu&ciudad=Madrid`; `&modo=hombro`; `&maps=URL_DE_GOOGLE_MAPS`.
La app procesa fotos localmente; los modelos de visión se descargan desde CDN. Los contadores de demostración son locales al dispositivo (`?panel=clinica`) y no sirven como analítica global.

En un repositorio público el PNG del personaje será accesible al público. Verifica las condiciones de uso del personaje antes de publicarlo.
