/* =====================================================================
   CONFIGURACIÓN DE LA APLICACIÓN  —  EDITA SOLO ESTE ARCHIVO
   ===================================================================== */
const CONFIG = {

  /* ---------- Identidad ---------- */
  APP_NAME:     "Proyecto Crecimiento Estructural",
  APP_SUBTITLE: "Censo municipal",
  LOGO:         "logo.png",        // Para cambiar el logo: reemplaza el archivo logo.png
                                   // o escribe aquí el nombre de otra imagen (ej. "mi-logo.jpg")
  THEME_COLOR:  "#6b1d2f",         // Color principal de la app

  /* ---------- Estructura del formulario ---------- */
  // Excel que se lee automáticamente la primera vez. Debe estar en el mismo repositorio/carpeta que index.html.
  // Déjalo "" si prefieres elegir el archivo manualmente. Aun así se puede cargar otro desde la pantalla inicial.
  DEFAULT_EXCEL: "BDD_001.xlsx",

  /* ---------- Cuenta de Google Drive que recibe la información ---------- */
  DRIVE_EMAIL:  "contacto.velsant@gmail.com",   // <-- CAMBIA AQUÍ LA CUENTA

  // Dirección (URL) del "receptor" de Google Apps Script publicado con la cuenta de arriba.
  // Se obtiene siguiendo los pasos de LEEME.md (archivo drive-receptor.gs).
  // Mientras esté vacío, el cierre de jornada guarda los archivos en el teléfono
  // y ofrece "Compartir" para mandarlos a Drive manualmente.

  DRIVE_UPLOAD_URL: "https://script.google.com/macros/s/AKfycbzhi7U_FqlmCF4YVpXlMp1vGoevcXPHBa8N5P2_8o4m-Zv6oifch-CPO6y7YdvgVdFo/exec",

  DRIVE_TOKEN:  "VelsantCenso2026_Seguridad",          // Debe ser igual al TOKEN de drive-receptor.gs
  DRIVE_FOLDER: "Proyecto Crecimiento Estructural", // Carpeta raíz en Drive (se crea sola)

  /* ---------- Seguimiento en tiempo real (se ve en monitor.html) ---------- */
  // Requiere DRIVE_UPLOAD_URL. El verificador comparte su ubicación SOLO mientras su jornada está iniciada
  // y la app está abierta; al cerrar la jornada se detiene. Avísales: es un monitoreo laboral.
  TRACKING_ENABLED:     true,
  TRACK_INTERVAL_SEC:   60,    // Cada cuántos segundos se envía la posición (30 a 120 recomendado)
  // El verificador NO puede pausar el envío: la ubicación se comparte desde que abre la app hasta que cierra su jornada.
  TRACK_KEEP_SCREEN_ON: true,  // Mantiene la pantalla encendida para no perder la señal (gasta más batería)

  /* ---------- Monitor (monitor.html) ---------- */
  MONITOR_POLL_SEC: 15,                 // Cada cuántos segundos se refresca el mapa
  MONITOR_LOGO:     "logo-vivir.png",   // Logo del panel del monitor
  KML_LOCAL:        "zonas_verificacion.kml", // Respaldo: exporta tu mapa de My Maps a KML y súbelo con este nombre
  MAP_CENTER: [19.72, -98.97], MAP_ZOOM: 12,
  // Puntos de logística (los de tu panel de rutas). Se muestran en el mapa y en la pestaña "Rutas".
  LOGISTICA: [
    { name: "LOGISTICA 001", lat: 19.685622, lng: -98.958736 },
    { name: "LOGISTICA 002", lat: 19.667297, lng: -98.968458 },
    { name: "LOGISTICA 003", lat: 19.664294, lng: -98.952633 },
    { name: "LOGISTICA 004", lat: 19.677058, lng: -98.955978 },
    { name: "LOGISTICA 005", lat: 19.767692, lng: -98.959986 },
    { name: "LOGISTICA 006", lat: 19.769125, lng: -98.949500 },
    { name: "LOGISTICA 007", lat: 19.749803, lng: -98.941806 },
    { name: "LOGISTICA 008", lat: 19.752472, lng: -98.947217 },
    { name: "LOGISTICA 009", lat: 19.771008, lng: -99.008100 },
  ],

  /* ---------- Reglas de captura ---------- */
  CLEAR_ON_CLOSE:  true,   // true = al cerrar la jornada se borran de la app los registros y fotos
                           // (el Excel de cada jornada se conserva en la app para el ZIP de Ajustes)
  /* ---------- Campos automáticos (se reconocen por el ENCABEZADO de la columna del Excel) ----------
     "fecha"     -> se llena sola con la fecha de hoy si está en blanco; visible y NO editable
     "hora"      -> se llena sola con la hora actual si está en blanco; visible y NO editable
     "concluye"  -> se llena sola con la hora en que se pulsa «Guardar»; visible y NO editable
     Puedes agregar más encabezados o cambiar los nombres.                                            */
  AUTO_FIELDS: { "FECHA": "fecha", "HORA": "hora", "CONCLUYE (HR)": "concluye" },
  DATE_FORMAT: "DD/MM/YYYY",       // Tokens: DD MM YYYY
  TIME_FORMAT: "HH:mm",            // Tokens: HH mm ss  (24 horas)

  GPS_OFFLINE_SECONDS: 45,        // Botón «Sin señal»: máximo de segundos buscando satélites
  GPS_OFFLINE_GOOD_METERS: 10,     // ...y se detiene antes si logra esta precisión (metros)
  FOLIO_DIGITS:    3,      // JSG001 -> 3 dígitos
  REQUIRE_COORDS:  true,   // Obligar a tomar la coordenada antes de guardar
  REQUIRE_PHOTO:   true,   // Obligar al menos una foto antes de guardar
  REQUIRE_ALL_FIELDS: false, // true = todos los campos de texto son obligatorios
  REQUIRED_FIELDS: [],     // O bien lista de encabezados obligatorios, ej. ["CAMPO 03","CAMPO 04"]

  PHOTO_MAX_PX:  1600,     // Lado máximo de la foto (reduce el peso)
  PHOTO_QUALITY: 0.8,      // Calidad JPEG 0 a 1

  /* ---------- Tipo de cada campo (opcional) ----------
     Por defecto todo es texto. Usa el ENCABEZADO EXACTO de la columna del Excel.
     Tipos: "text", "textarea", "number", "date", "tel", "select"                */
  FIELD_TYPES: {
    "NARRACIÓN OBJETIVA DE HECHOS Y MOTIVOS:": "textarea",   // cuadro de texto grande
    // "CAMPO 04": "number",
    // "CAMPO 05": "textarea",
    // "CAMPO 06": "select",
  },
  // Opciones para los campos tipo "select"
  FIELD_OPTIONS: {
    // "CAMPO 06": ["Sí", "No"],
  },
};
