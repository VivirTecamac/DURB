/**
 * RECEPTOR PARA GOOGLE DRIVE  (Google Apps Script)
 * Pégalo en https://script.google.com con la sesión de contacto.velsant@gmail.com
 * Instrucciones completas en LEEME.md
 */

// Contraseña (NO es una URL). Debe ser IDÉNTICA a DRIVE_TOKEN en config.js
const TOKEN = "VelsantCenso2026_Seguridad";

const MIMES = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "application/zip"];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, error: "Token incorrecto" });

    // Validaciones básicas para que nadie suba cosas raras
    if (!/^[\w.\- ]+$/.test(d.fileName)) return out({ ok: false, error: "Nombre de archivo no válido" });
    if (!/^[\w.\- \/À-ſ]+$/.test(d.folder) || d.folder.indexOf("..") >= 0) return out({ ok: false, error: "Carpeta no válida" });
    if (MIMES.indexOf(d.mimeType) < 0) return out({ ok: false, error: "Tipo de archivo no permitido" });

    // d.folder llega como "Carpeta raíz/JSG_2026-11-18"; se crea si no existe
    let folder = DriveApp.getRootFolder();
    d.folder.split("/").forEach(function (name) { folder = getOrCreate(folder, name); });

    // Si ya existe un archivo con el mismo nombre, se reemplaza
    const old = folder.getFilesByName(d.fileName);
    while (old.hasNext()) old.next().setTrashed(true);

    const blob = Utilities.newBlob(Utilities.base64Decode(d.data), d.mimeType, d.fileName);
    folder.createFile(blob);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

// Sirve para comprobar en el navegador que el despliegue está activo
function doGet() { return out({ ok: true, mensaje: "Receptor activo" }); }

function getOrCreate(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
