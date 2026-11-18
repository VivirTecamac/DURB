# Proyecto Crecimiento Estructural — App de censo

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `config.js` | **Aquí cambias todo**: nombre, logo, cuenta de Drive, reglas, tipos de campo |
| `logo.png` | Logo. Reemplaza el archivo (mismo nombre) o cambia `LOGO` en config.js |
| `index.html`, `app.js` | La aplicación |
| `manifest.json`, `icon-192.png`, `icon-512.png` | Instalación en el teléfono (nombre e ícono) |
| `sw.js` | Permite usarla sin internet |
| `drive-receptor.gs` | Código para recibir los archivos en Google Drive |

## Excel por omisión
Sube `BDD_001.xlsx` al mismo repositorio, junto a `index.html`. La app lo lee sola la primera vez. Para usar otro nombre cambia `DEFAULT_EXCEL` en `config.js`; también se puede elegir otro archivo en la pantalla inicial o en Ajustes (⚙).

## Cómo ponerla en el teléfono
La app debe abrirse desde una dirección **https** (el GPS y la cámara lo exigen). Sube la carpeta completa a
GitHub Pages, Netlify o Cloudflare Pages (gratis), abre la dirección en Chrome del celular y elige
**Menú ⋮ → Instalar aplicación**. Después funciona sin internet.

## Cómo conectar Google Drive (contacto.velsant@gmail.com)
Una página web no puede escribir en Drive sin autorización, por eso se usa un pequeño receptor:
1. Entra a https://script.google.com con la cuenta contacto.velsant@gmail.com → **Nuevo proyecto**.
2. Borra el contenido y pega `drive-receptor.gs`. Cambia `TOKEN` por una clave propia.
3. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: *Yo*. Quién tiene acceso: *Cualquier persona*.
4. Autoriza los permisos y copia la URL que termina en `/exec`.
5. En `config.js` pega esa URL en `DRIVE_UPLOAD_URL` y la misma clave en `DRIVE_TOKEN`.

En Drive se crea `Proyecto Crecimiento Estructural/JSG_2026-11-18/` con el Excel y las fotos.
Para cambiar de cuenta: repite los pasos con la otra cuenta y cambia `DRIVE_EMAIL` y `DRIVE_UPLOAD_URL`.

## Funcionamiento
- Primera vez: nombre del verificador (iniciales automáticas, editables) y carga del Excel; la primera fila define los campos.
- Columna 1 = clave autogenerada (JSG001, JSG002…), bloqueada y sin repetirse. Columna 2 = coordenada tomada con el botón GPS.
- Fotos: `JSG001_1.jpg`, `JSG001_2.jpg`…
- **Guardar**: el registro queda en la memoria de la app (no se pierde aunque se cierre o se apague el teléfono).
- **Cierre de jornada**: genera `JSG_fecha.xlsx` + `JSG_fecha_fotos.zip` en la carpeta Descargas del teléfono y los envía a Drive.
  Si falla el envío, la jornada sigue abierta para reintentar.
- Al cerrar la jornada con éxito, la app borra de su memoria los registros y fotos (`CLEAR_ON_CLOSE` en config.js). Se conserva el contador de folios (no se repiten claves) y una copia del Excel de cada jornada.
- Ajustes (⚙): **Descargar TODO** = un ZIP con todos los Excel de jornadas cerradas, el de la jornada en curso y las fotos que aún estén en la app.
- Ajustes (⚙): descargar Excel/CSV de la jornada o de todos los registros.

## Seguimiento en tiempo real de verificadores (monitor.html)
- **Verificador:** al abrir su primer registro de la jornada la app empieza a compartir su ubicación cada `TRACK_INTERVAL_SEC` segundos
  (con la pantalla encendida y la app abierta; el navegador no puede rastrear con la pantalla apagada). Al cerrar la jornada se detiene.
  Puede pausar con el botón de la tarjeta de inicio (se desactiva con `TRACK_ALLOW_PAUSE: false`). Avísales que es un monitoreo laboral.
- **Supervisor:** abre `monitor.html` (misma carpeta/repositorio). Pide la clave de monitoreo (`MONITOR_TOKEN` del receptor; se guarda en ese dispositivo).
  Muestra tus polígonos de My Maps, los puntos de logística, a cada verificador (verde = en línea, ámbar = sin señal reciente, gris = sin conexión),
  sus registros del día, recorrido y precisión GPS. Pestaña "Rutas" = tus 9 destinos de navegación.
- **Receptor:** pega el nuevo `drive-receptor.gs`, cambia `MONITOR_TOKEN` por una clave propia y publica **Nueva versión** (ver arriba).
  El mapa de My Maps debe estar compartido como "Cualquier persona con el enlace". Si no carga, exporta el KML y súbelo como `zonas_verificacion.kml`.
