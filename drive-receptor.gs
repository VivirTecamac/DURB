/**
 * RECEPTOR PARA GOOGLE DRIVE + SEGUIMIENTO EN VIVO  (Google Apps Script)
 * Pégalo en https://script.google.com con la sesión de contacto.velsant@gmail.com
 * Instrucciones completas en LEEME.md
 *
 * Funciones:
 *  - POST  (app del verificador): sube Excel/fotos a Drive  y  reporta su ubicación ("ping")
 *  - GET ?action=positions       (monitor.html): últimas posiciones de los verificadores
 *  - GET ?action=kml             (monitor.html): polígonos de tu mapa de My Maps
 */

// Contraseña que usa la app de los verificadores. IDÉNTICA a DRIVE_TOKEN en config.js
const TOKEN = "VelsantCenso2026_Seguridad";

// Contraseña SOLO para quien supervisa (se escribe en monitor.html, no está en el código público).
// ¡Cámbiala por una propia!
const MONITOR_TOKEN = "VelsantMonitor2026";

// ID de tu mapa de My Maps (lo que va después de mid= en la dirección). El mapa debe estar
// compartido como "Cualquier persona con el enlace" (igual que para incrustarlo).
const KML_MAP_ID = "1GIz2dXEl-IxBvFGsPTf0fCWlTdyNsec";

const MIMES = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "application/zip"];
const POS_PREFIX = "pos_";
const POS_MAX_AGE_MS = 24 * 3600 * 1000;   // posiciones más viejas de 24 h se borran solas

/* ---------------------------- POST ---------------------------- */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, error: "Token incorrecto" });

    if (d.action === "ping") return savePing(d);

    // ---- Subida de archivos a Drive ----
    if (!/^[\w.\- ]+$/.test(d.fileName)) return out({ ok: false, error: "Nombre de archivo no válido" });
    if (!/^[\w.\- \/À-ſ]+$/.test(d.folder) || d.folder.indexOf("..") >= 0) return out({ ok: false, error: "Carpeta no válida" });
    if (MIMES.indexOf(d.mimeType) < 0) return out({ ok: false, error: "Tipo de archivo no permitido" });

    let folder = DriveApp.getRootFolder();
    d.folder.split("/").forEach(function (name) { folder = getOrCreate(folder, name); });

    const old = folder.getFilesByName(d.fileName);
    while (old.hasNext()) old.next().setTrashed(true);

    folder.createFile(Utilities.newBlob(Utilities.base64Decode(d.data), d.mimeType, d.fileName));
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function savePing(d) {
  if (!/^[A-Za-z0-9]{1,8}$/.test(String(d.id))) return out({ ok: false, error: "ID no válido" });
  const props = PropertiesService.getScriptProperties();
  const key = POS_PREFIX + d.id;
  let rec;
  if (d.status === "off") {
    // Fin de jornada / pausa: se conserva la última posición conocida
    const prev = props.getProperty(key);
    rec = prev ? JSON.parse(prev) : { id: d.id, lat: null, lng: null };
    rec.status = "off";
  } else {
    const lat = Number(d.lat), lng = Number(d.lng);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return out({ ok: false, error: "Coordenada no válida" });
    rec = { id: d.id, lat: lat, lng: lng, acc: Number(d.acc) || null, status: "on" };
  }
  rec.name = String(d.name || rec.name || "").slice(0, 60);
  rec.registros = Number(d.registros) || 0;
  rec.ts = Date.now();
  props.setProperty(key, JSON.stringify(rec));
  return out({ ok: true });
}

/* ---------------------------- GET ----------------------------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === "positions" || p.action === "kml") {
    if (p.token !== MONITOR_TOKEN) return out({ ok: false, error: "Clave de monitoreo incorrecta" });
    return out(p.action === "positions" ? { ok: true, now: Date.now(), items: readPositions() } : getKml());
  }
  return out({ ok: true, mensaje: "Receptor activo" });   // prueba rápida desde el navegador
}

function readPositions() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties(), items = [], now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(POS_PREFIX) !== 0) return;
    try {
      const r = JSON.parse(all[k]);
      if (now - r.ts > POS_MAX_AGE_MS) props.deleteProperty(k); else items.push(r);
    } catch (err) { props.deleteProperty(k); }
  });
  return items;
}

function getKml() {
  try {
    const r = UrlFetchApp.fetch("https://www.google.com/maps/d/kml?mid=" + KML_MAP_ID + "&forcekml=1", { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() !== 200) return { ok: false, error: "My Maps respondió HTTP " + r.getResponseCode() + ". Comparte el mapa como «Cualquier persona con el enlace»." };
    return { ok: true, kml: r.getContentText() };
  } catch (err) { return { ok: false, error: String(err) }; }
}

/* --------------------------- Utilidades ------------------------ */
function getOrCreate(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
