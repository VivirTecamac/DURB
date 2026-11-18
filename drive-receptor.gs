/**
 * RECEPTOR PARA GOOGLE DRIVE  (Google Apps Script)
 * Pégalo en https://script.google.com con la sesión de contacto.velsant@gmail.com
 * Instrucciones completas en LEEME.md
 */
const TOKEN = "cambia-este-token";   // Debe ser igual a DRIVE_TOKEN en config.js

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, error: "Token incorrecto" });

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

function getOrCreate(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
