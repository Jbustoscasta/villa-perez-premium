# Sonido real y luz nocturna — Villa Pérez v1.3

## Qué suena
- Quemador de globo aerostático: grabación de campo real de **YannSauvin**, «Hot air balloon burner», Freesound ID 778358, 22 diciembre 2024. Original **CC0 1.0** (se puede reutilizar en proyectos comerciales). Fuente: https://freesound.org/people/YannSauvin/sounds/778358/ y https://creativecommons.org/publicdomain/zero/1.0/
- El MP3 publicado es una mezcla original de distintas ráfagas de esa grabación, con envolventes para que el fuego entre y salga naturalmente.
- Partículas mágicas: pequeñas texturas brillantes generadas por síntesis procedural, con alturas, duraciones y posiciones estéreo variables. No existen grabaciones reales de «magia»; estos acentos son ficción sonora. No se utiliza música, melodía, voz ni bucles cortos de efecto.
- Master 30 segundos, estéreo MP3, 22.050 Hz, ~421 KB. La webapp puede utilizar de 8 a 30 segundos.
- Receta reproducible: `tools/build-sound.py` + grabación de origen.

## Cómo se adapta la iluminación
La foto se reduce a un mapa local de 64 × 114 píxeles únicamente en memoria del dispositivo. Se estima la luminosidad **detrás de la posición actual del globo** y se aplica un ajuste de exposición y saturación al vídeo *después* del chroma. Así una foto de noche oscura no recibe un globo excesivamente luminoso. El algoritmo se ejecuta localmente, sin subir fotografías ni usar IA o servicios remotos.

El usuario puede tocar «☾ Luz Auto» en la escena, desactivar Auto y graduar el brillo entre 30% y 150%; también puede ajustar el valor relativo mientras Auto está activo. La barra se aplica a vista previa y exportación.

## Privacidad y compatibilidad
- Las fotos no se envían a GitHub ni a servidores externos.
- Probado en Chromium y WebKit en tamaños representativos de móvil y escritorio mediante Playwright.
- Safari en un iPhone físico y la exportación MP4 dependen de capacidades reales del sistema y requieren prueba en el dispositivo final.
