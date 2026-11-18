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

  DRIVE_UPLOAD_URL: "https://google.comhttps://script.google.com/macros/s/AKfycbzhi7U_FqlmCF4YVpXlMp1vGoevcXPHBa8N5P2_8o4m-Zv6oifch-CPO6y7YdvgVdFo/exec",

  DRIVE_TOKEN:  "VelsantCenso2026_Seguridad",          // Debe ser igual al TOKEN de drive-receptor.gs
  DRIVE_FOLDER: "Proyecto Crecimiento Estructural", // Carpeta raíz en Drive (se crea sola)

  /* ---------- Reglas de captura ---------- */
  CLEAR_ON_CLOSE:  true,   // true = al cerrar la jornada se borran de la app los registros y fotos
                           // (el Excel de cada jornada se conserva en la app para el ZIP de Ajustes)
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
    // "CAMPO 04": "number",
    // "CAMPO 05": "textarea",
    // "CAMPO 06": "select",
  },
  // Opciones para los campos tipo "select"
  FIELD_OPTIONS: {
    // "CAMPO 06": ["Sí", "No"],
  },
};
