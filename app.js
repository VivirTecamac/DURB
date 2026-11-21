"use strict";
/* =====================================================================
   Proyecto Crecimiento Estructural — lógica de la aplicación
   Sin librerías externas: lee/escribe .xlsx con código propio (funciona sin internet).
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n, w) => String(n).padStart(w, "0");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`; };
const nowTime = () => { const d = new Date(); return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`; };

/* ------------------------------------------------------------------ */
/*  Estado + IndexedDB                                                 */
/* ------------------------------------------------------------------ */
const S = { columns: [], verifier: null, counters: {}, jornada: null, closed: {}, records: [], draft: null, tracking: false };
let db;

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("pce-censo", 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
      if (!d.objectStoreNames.contains("records")) d.createObjectStore("records", { keyPath: "clave" });
      if (!d.objectStoreNames.contains("photos")) d.createObjectStore("photos", { keyPath: "name" }).createIndex("clave", "clave");
      if (!d.objectStoreNames.contains("archive")) d.createObjectStore("archive", { keyPath: "name" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const rq = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const st = (n, m = "readonly") => db.transaction(n, m).objectStore(n);
const dbGet = (s, k) => rq(st(s).get(k));
const dbAll = (s) => rq(st(s).getAll());
const dbPut = (s, v, k) => rq(st(s, "readwrite").put(v, k));
const saveMeta = () => Promise.all([
  dbPut("meta", S.columns, "columns"), dbPut("meta", S.verifier, "verifier"), dbPut("meta", S.counters, "counters"),
  dbPut("meta", S.jornada, "jornada"), dbPut("meta", S.closed, "closed"), dbPut("meta", S.tracking, "tracking"),
]);

async function loadState() {
  S.columns = (await dbGet("meta", "columns")) || [];
  S.verifier = (await dbGet("meta", "verifier")) || null;
  S.counters = (await dbGet("meta", "counters")) || {};
  S.jornada = (await dbGet("meta", "jornada")) || null;
  S.closed = (await dbGet("meta", "closed")) || {};
  S.tracking = !!(await dbGet("meta", "tracking")); S.trackStopDay = (await dbGet("meta", "trackStopDay")) || null;
  S.records = (await dbAll("records")).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
}

/* ------------------------------------------------------------------ */
/*  Utilidades de UI                                                   */
/* ------------------------------------------------------------------ */
let toastT;
function toast(msg, kind = "") {
  const t = $("#toast"); t.textContent = msg; t.className = "toast " + kind; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200);
}
function show(view) {
  ["setup", "home", "form", "list"].forEach((v) => ($("#v-" + v).hidden = v !== view));
  $("#formBar").hidden = view !== "form";
  $("#btnSettings").hidden = view === "setup" || view === "form";
  window.scrollTo(0, 0);
}
function netChip() {
  const c = $("#netChip"); const on = navigator.onLine;
  c.textContent = on ? "En línea" : "Sin internet"; c.className = "chip " + (on ? "on" : "off");
}

/* ------------------------------------------------------------------ */
/*  Iniciales / folio                                                  */
/* ------------------------------------------------------------------ */
function initialsFrom(name) {
  const skip = new Set(["de", "del", "la", "las", "los", "y", "e", "el"]);
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/)
    .filter((w) => w && !skip.has(w.toLowerCase())).map((w) => w[0].toUpperCase()).join("").replace(/[^A-Z]/g, "").slice(0, 5);
}
function nextClave() {
  const ini = S.verifier.initials; const w = CONFIG.FOLIO_DIGITS;
  let n = (S.counters[ini] || 0) + 1;
  const used = new Set(S.records.map((r) => r.clave));
  while (used.has(ini + pad(n, w))) n++;
  return ini + pad(n, w);
}
const jornadaRecords = () => S.records.filter((r) => r.jornada === S.jornada);

/* ------------------------------------------------------------------ */
/*  ZIP (sin compresión) y XLSX — escritura                            */
/* ------------------------------------------------------------------ */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function zipStore(files, mime = "application/zip") {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const nm = enc.encode(f.name), len = f.data.length, crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, len, true); lh.setUint32(22, len, true); lh.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, len, true); ch.setUint32(24, len, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + len;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: mime });
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const colName = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const xmlEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function buildXlsx(columns, rows) {
  const cell = (r, c, v, style) => `<c r="${colName(c)}${r}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  let sd = `<row r="1">${columns.map((h, c) => (h ? cell(1, c, h, 1) : "")).join("")}</row>`;
  rows.forEach((row, i) => { sd += `<row r="${i + 2}">${columns.map((h, c) => (h ? cell(i + 2, c, row[c] ?? "") : "")).join("")}</row>`; });
  const cols = columns.map((h, c) => `<col min="${c + 1}" max="${c + 1}" width="${Math.max(14, Math.min(40, String(h).length + 4))}" customWidth="1"/>`).join("");
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const enc = new TextEncoder();
  const f = (name, xml) => ({ name, data: enc.encode(X + xml) });
  return zipStore([
    f("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    f("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    f("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    f("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    f("xl/styles.xml", '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs></styleSheet>'),
    f("xl/worksheets/sheet1.xml", `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sd}</sheetData></worksheet>`),
  ], XLSX_MIME);
}

function buildCsv(columns, rows) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return new Blob(["﻿" + [columns, ...rows].map((r) => columns.map((_, i) => q(r[i])).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
}

/* ------------------------------------------------------------------ */
/*  XLSX — lectura (solo encabezados de la primera fila)               */
/* ------------------------------------------------------------------ */
async function unzip(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf), dec = new TextDecoder();
  let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("El archivo no es un Excel (.xlsx) válido.");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
  for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    files[dec.decode(u.subarray(p + 46, p + 46 + nl))] = { method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
    p += 46 + nl + xl + cl;
  }
  return {
    async read(name) {
      const f = files[name]; if (!f) return null;
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      const data = u.subarray(start, start + f.csize);
      if (f.method === 0) return dec.decode(data);
      if (typeof DecompressionStream === "undefined") throw new Error("Este navegador no puede leer Excel. Actualiza Chrome o Safari.");
      return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    },
  };
}
const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
const nCols = (c) => c.filter(Boolean).length;   // columnas con encabezado
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

async function excelSheets(file) {
  const z = await unzip(await file.arrayBuffer());
  const wb = await z.read("xl/workbook.xml"); if (!wb) throw new Error("El archivo no es un Excel (.xlsx) válido.");
  const rels = xml((await z.read("xl/_rels/workbook.xml.rels")) || "<r/>");
  const target = {}; rels.querySelectorAll("Relationship").forEach((r) => { let t = r.getAttribute("Target"); t = t.startsWith("/") ? t.slice(1) : "xl/" + t; target[r.getAttribute("Id")] = t; });
  const sheets = [...xml(wb).querySelectorAll("sheet")].map((s) => ({ name: s.getAttribute("name"), path: target[s.getAttributeNS(REL_NS, "id")] || "xl/worksheets/sheet1.xml" }));
  return { z, sheets };
}
async function excelHeaders(z, sheetPath) {
  const ssXml = await z.read("xl/sharedStrings.xml");
  const shared = ssXml ? [...xml(ssXml).querySelectorAll("si")].map((si) => [...si.querySelectorAll("t")].filter((t) => !t.closest("rPh")).map((t) => t.textContent).join("")) : [];
  const sh = xml(await z.read(sheetPath));
  let best = null;
  for (const row of sh.querySelectorAll("row")) {
    const cells = [];
    row.querySelectorAll("c").forEach((c) => {
      const t = c.getAttribute("t"); let v = "";
      if (t === "s") v = shared[+c.querySelector("v")?.textContent] ?? "";
      else if (t === "inlineStr") v = [...c.querySelectorAll("t")].map((x) => x.textContent).join("");
      else v = c.querySelector("v")?.textContent ?? "";
      if (!v.trim()) return;   // se conserva el texto original del encabezado
      const letters = (c.getAttribute("r") || "A1").replace(/\d+/g, "");
      let idx = 0; for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
      cells.push([idx, v]);
    });
    if (cells.length) {
      best = []; cells.forEach(([i, v]) => (best[i - 1] = v));
      best = Array.from(best, (v) => v ?? "");            // columnas vacías se conservan como ""
      while (best.length && best[0] === "") best.shift();  // sin columnas en blanco al inicio
      break;
    }
  }
  if (!best) throw new Error("La hoja está vacía: no encontré encabezados en la primera fila.");
  return best;
}

/* ------------------------------------------------------------------ */
/*  Pantalla de configuración inicial                                  */
/* ------------------------------------------------------------------ */
let setupCols = null;
async function handleExcelFile(file, sheetSel, boxSel, msgEl, onCols) {
  try {
    const { z, sheets } = await excelSheets(file);
    const sel = $(sheetSel), box = $(boxSel);
    async function load() { const cols = await excelHeaders(z, sheets[Math.max(0, sel.selectedIndex)].path); onCols(cols); }
    if (sheets.length > 1) { sel.innerHTML = sheets.map((s) => `<option>${esc(s.name)}</option>`).join(""); box.hidden = false; sel.onchange = () => load().catch((e) => (msgEl.textContent = e.message)); }
    else if (box) box.hidden = true;
    await load();
  } catch (e) { msgEl.textContent = "⚠ " + e.message; onCols(null); }
}
function refreshSetup() {
  const name = $("#setName").value.trim();
  $("#setPreview").innerHTML = name && $("#setInit").value ? `Primer folio: <b>${esc($("#setInit").value.toUpperCase() + pad(1, CONFIG.FOLIO_DIGITS))}</b> · Archivo: <b>${esc($("#setInit").value.toUpperCase())}_${today()}.xlsx</b>` : "";
}
function initSetup() {
  $("#setExcelBox").hidden = S.columns.length > 0;
  $("#setName").value = S.verifier?.name || ""; $("#setInit").value = S.verifier?.initials || "";
  $("#setName").oninput = () => { $("#setInit").value = initialsFrom($("#setName").value); refreshSetup(); };
  $("#setInit").oninput = refreshSetup;
  const loadSetup = (f, label) => handleExcelFile(f, "#setSheet", "#setSheetBox", $("#setCols"), (cols) => {
    setupCols = cols;
    if (cols) $("#setCols").textContent = `✔ ${label}: ${nCols(cols)} campos detectados (${cols.filter(Boolean).slice(0, 4).join(", ")}${nCols(cols) > 4 ? "…" : ""})`;
  });
  $("#setFile").onchange = (e) => { const f = e.target.files[0]; if (f) loadSetup(f, f.name); };
  setupCols = null;
  if (!S.columns.length && CONFIG.DEFAULT_EXCEL) {
    $("#setCols").textContent = `Buscando ${CONFIG.DEFAULT_EXCEL}…`;
    fetch(CONFIG.DEFAULT_EXCEL, { cache: "no-store" }).then((r) => { if (!r.ok) throw 0; return r.blob(); })
      .then((b) => loadSetup(b, CONFIG.DEFAULT_EXCEL))
      .catch(() => ($("#setCols").textContent = `No se encontró ${CONFIG.DEFAULT_EXCEL} en el repositorio. Selecciona el archivo Excel manualmente.`));
  }
  $("#btnStart").onclick = async () => {
    const name = $("#setName").value.trim().replace(/\s+/g, " "), ini = $("#setInit").value.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (name.length < 3) return toast("Escribe el nombre del verificador", "err");
    if (ini.length < 2) return toast("Las iniciales deben tener al menos 2 letras", "err");
    if (!S.columns.length) {
      if (!setupCols) return toast("Carga el archivo Excel con la estructura", "err");
      if (nCols(setupCols) < 3) return toast("El Excel debe tener al menos 3 columnas", "err");
      S.columns = setupCols;
    }
    S.verifier = { name, initials: ini }; await saveMeta(); goHome(); autoTrack();
  };
  show("setup"); refreshSetup();
}

/* ------------------------------------------------------------------ */
/*  Inicio                                                             */
/* ------------------------------------------------------------------ */
async function photoCount(recs) { const all = await dbAll("photos"); const set = new Set(recs.map((r) => r.clave)); return all.filter((p) => set.has(p.clave)).length; }
async function goHome() {
  const jr = jornadaRecords();
  $("#homeWho").textContent = S.verifier.name + " (" + S.verifier.initials + ")";
  $("#homeJornada").textContent = S.jornada ? `Jornada abierta desde ${S.jornada}` : "Sin jornada abierta: inicia con tu primer registro.";
  $("#stRec").textContent = jr.length; $("#stPho").textContent = await photoCount(jr); $("#stNext").textContent = nextClave();
  const b = $("#homeBanner");
  if (!CONFIG.DRIVE_UPLOAD_URL) { b.hidden = false; b.textContent = `Envío automático a Drive (${CONFIG.DRIVE_EMAIL}) sin configurar. Al cerrar la jornada los archivos se guardarán en el teléfono y podrás compartirlos manualmente.`; }
  else b.hidden = true;
  updateTrackUI();
  show("home");
}

/* ------------------------------------------------------------------ */
/*  Formulario                                                         */
/* ------------------------------------------------------------------ */
const key = (h) => String(h).trim().toUpperCase();
const typeOf = (h) => { const k = Object.keys(CONFIG.FIELD_TYPES).find((x) => key(x) === key(h)); return k ? CONFIG.FIELD_TYPES[k] : "text"; };
const optsOf = (h) => { const k = Object.keys(CONFIG.FIELD_OPTIONS).find((x) => key(x) === key(h)); return k ? CONFIG.FIELD_OPTIONS[k] : []; };
const isRequired = (h) => CONFIG.REQUIRE_ALL_FIELDS || CONFIG.REQUIRED_FIELDS.some((x) => key(x) === key(h));

/* ---- Campos automáticos por nombre de columna (FECHA, HORA, CONCLUYE (HR)) ---- */
const normH = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "").toUpperCase();
function autoKind(h) { const k = Object.keys(CONFIG.AUTO_FIELDS || {}).find((x) => normH(x) === normH(h)); return k ? CONFIG.AUTO_FIELDS[k] : null; }
function fmtNow(pattern, d = new Date()) {
  return String(pattern).replace(/YYYY|DD|MM|HH|mm|ss/g, (t) => ({ YYYY: d.getFullYear(), DD: pad(d.getDate(), 2), MM: pad(d.getMonth() + 1, 2), HH: pad(d.getHours(), 2), mm: pad(d.getMinutes(), 2), ss: pad(d.getSeconds(), 2) }[t]));
}
const nowFor = (kind) => (kind === "fecha" ? fmtNow(CONFIG.DATE_FORMAT || "DD/MM/YYYY") : fmtNow(CONFIG.TIME_FORMAT || "HH:mm"));
function autoFieldHtml(h, idx, kind) {
  if (kind === "concluye")   // se llena sola al pulsar Guardar; visible y no editable
    return `<label class="f"><span>${esc(h)} (se llena al guardar)</span><div class="lock"><input data-i="${idx}" data-auto="concluye" readonly placeholder="Se llena al guardar" value=""><span aria-hidden="true">🔒</span></div></label>`;
  return `<label class="f"><span>${esc(h)} (automático)</span><div class="lock"><input data-i="${idx}" data-auto="${kind}" readonly value="${esc(nowFor(kind))}"><span aria-hidden="true">🔒</span></div></label>`;
}

function openForm() {
  if (!T.on) startTracking();
  S.draft = { clave: nextClave(), coords: "", acc: null, photos: [] };
  const f = $("#form");
  let html = `<div class="card">`;
  html += `<label class="f"><span>${esc(S.columns[0])} (automática)</span><div class="lock"><input id="fClave" readonly value="${esc(S.draft.clave)}" aria-readonly="true"><span aria-hidden="true">🔒</span></div></label>`;
  html += `<div class="f"><span class="lbl">${esc(S.columns[1])}</span><div class="coordbox" id="coordBox"><div class="val" id="coordVal">Sin capturar</div><div class="muted" id="coordAcc"></div>
    <div class="gpsrow"><button type="button" class="btn small" id="btnGps">📍 Tomar coordenada de mi ubicación</button>
    <button type="button" class="btn small alt" id="btnGpsOff">🛰 Sin señal (sin internet)</button></div></div></div>`;
  S.columns.slice(2).forEach((h, i) => {
    if (!h) return;   // columna en blanco del Excel: se conserva en el archivo exportado pero no se captura
    const t = typeOf(h), idx = i + 2, req = isRequired(h) ? " *" : "";
    const ak = autoKind(h); if (ak) { html += autoFieldHtml(h, idx, ak); return; }
    let inp;
    if (t === "textarea") inp = `<textarea data-i="${idx}"></textarea>`;
    else if (t === "select") inp = `<select data-i="${idx}"><option value="">— Selecciona —</option>${optsOf(h).map((o) => `<option>${esc(o)}</option>`).join("")}</select>`;
    else inp = `<input data-i="${idx}" type="${["number", "date", "tel"].includes(t) ? t : "text"}" ${t === "number" ? 'inputmode="decimal" step="any"' : ""} autocapitalize="sentences">`;
    html += `<label class="f"><span>${esc(h)}${req}</span>${inp}</label>`;
  });
  html += `</div><div class="card"><span class="lbl">Fotografías del sitio${CONFIG.REQUIRE_PHOTO ? " *" : ""}</span>
    <p class="muted" style="margin:0 0 8px">Se guardarán como ${esc(S.draft.clave)}_1, ${esc(S.draft.clave)}_2…</p>
    <input type="file" id="fPhoto" accept="image/*" capture="environment" hidden>
    <button type="button" class="btn alt small" id="btnPhoto">📷 Tomar foto</button>
    <div class="thumbs" id="thumbs"></div></div>`;
  f.innerHTML = html;
  $("#btnGps").onclick = captureGps; $("#btnGpsOff").onclick = captureGpsOffline;
  $("#btnPhoto").onclick = () => $("#fPhoto").click();
  $("#fPhoto").onchange = addPhoto;
  show("form");
}

const GPS_BTN = { on: "📍 Tomar coordenada de mi ubicación", off: "🛰 Sin señal (sin internet)" };
function gpsBusy(busy, which) {
  $("#btnGps").disabled = $("#btnGpsOff").disabled = busy;
  if (!busy) { $("#btnGps").textContent = S.draft?.coords ? "📍 Volver a tomar coordenada" : GPS_BTN.on; $("#btnGpsOff").textContent = GPS_BTN.off; }
}
/* Guarda la coordenada en el MISMO campo para los dos botones (así la validación de "falta coordenada" no falla) */
function applyFix(p, modo) {
  const lat = p.coords.latitude.toFixed(6), lng = p.coords.longitude.toFixed(6);
  S.draft.coords = `${lat},${lng}`; S.draft.acc = Math.round(p.coords.accuracy);
  $("#coordVal").textContent = `${lat}, ${lng}`;
  $("#coordAcc").textContent = `Precisión aproximada: ±${S.draft.acc} m · ${modo}` + (S.draft.acc > 50 ? " — precisión baja: repite la captura a cielo abierto" : "");
  $("#coordBox").classList.add("ok");
}
const gpsError = (err) => err.code === 1 ? "Permiso de ubicación denegado. Actívalo en los ajustes del navegador para este sitio."
  : err.code === 2 ? "Señal satelital no disponible. Aléjate de techos y árboles densos." : "Tiempo agotado. Intenta de nuevo bajo cielo despejado.";

function captureGps() {
  if (!navigator.geolocation) return toast("Este dispositivo no tiene GPS disponible", "err");
  gpsBusy(true); $("#btnGps").textContent = "Buscando señal GPS…";
  navigator.geolocation.getCurrentPosition((p) => { applyFix(p, navigator.onLine ? "Con red" : "Sin internet (satélite)"); gpsBusy(false); },
    (err) => { gpsBusy(false); toast(gpsError(err), "err"); }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
}

/* Modo SIN SEÑAL: usa solo el chip GPS satelital y espera hasta GPS_OFFLINE_SECONDS segundos (sin internet el
   primer punto tarda más). Se queda con el punto más preciso que logre y lo guarda en el campo de coordenada. */
function captureGpsOffline() {
  if (!navigator.geolocation) return toast("Este dispositivo no tiene GPS disponible", "err");
  const maxMs = (CONFIG.GPS_OFFLINE_SECONDS || 45) * 1000, good = CONFIG.GPS_OFFLINE_GOOD_METERS || 10, t0 = Date.now();
  let best = null, lastErr = null, done = false, id = null, tick = null;
  gpsBusy(true); $("#coordAcc").textContent = "Buscando satélites… mantente quieto en el terreno.";
  const finish = () => {
    if (done) return; done = true; navigator.geolocation.clearWatch(id); clearInterval(tick); gpsBusy(false);
    if (best) { applyFix(best, "Sin señal (GPS satelital)"); toast("Coordenada guardada", "ok"); }
    else { $("#coordAcc").textContent = ""; toast(lastErr ? gpsError(lastErr) : "No se obtuvo señal GPS. Intenta de nuevo bajo cielo despejado.", "err"); }
  };
  id = navigator.geolocation.watchPosition((p) => {
    if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
    if (p.coords.accuracy <= good) finish();
  }, (err) => { lastErr = err; if (err.code === 1) finish(); },   // permiso denegado: se corta; otros errores se siguen intentando
  { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
  tick = setInterval(() => {
    const s = Math.max(0, Math.round((maxMs - (Date.now() - t0)) / 1000));
    $("#btnGpsOff").textContent = `🛰 Buscando… ${s} s` + (best ? ` (±${Math.round(best.coords.accuracy)} m)` : "");
    if (Date.now() - t0 >= maxMs) finish();
  }, 500);
}

async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, CONFIG.PHOTO_MAX_PX / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((r) => c.toBlob((b) => r(b || file), "image/jpeg", CONFIG.PHOTO_QUALITY));
}
async function addPhoto(e) {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { const blob = await shrink(f); S.draft.photos.push({ blob, url: URL.createObjectURL(blob) }); drawThumbs(); }
  catch { toast("No se pudo procesar la foto", "err"); }
}
function drawThumbs() {
  $("#thumbs").innerHTML = S.draft.photos.map((p, i) => `<div class="thumb"><img src="${p.url}" alt=""><em>${esc(S.draft.clave)}_${i + 1}</em><button type="button" data-rm="${i}" aria-label="Quitar">✕</button></div>`).join("");
  $("#thumbs").querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { URL.revokeObjectURL(S.draft.photos[+b.dataset.rm].url); S.draft.photos.splice(+b.dataset.rm, 1); drawThumbs(); }));
}
function formDirty() { return !!(S.draft.coords || S.draft.photos.length || [...$("#form").querySelectorAll("[data-i]:not([data-auto=\"fecha\"]):not([data-auto=\"hora\"])")].some((x) => x.value.trim())); }
function closeForm() { S.draft?.photos.forEach((p) => URL.revokeObjectURL(p.url)); S.draft = null; goHome(); }

async function saveRecord() {
  const d = S.draft, btn = $("#btnSave");
  // PRIMERA instrucción: CONCLUYE (HR) se llena con la hora de este momento (así nunca queda vacío al validar)
  const cInp = $('[data-auto="concluye"]'); if (cInp) cInp.value = nowFor("hora");
  const values = new Array(S.columns.length).fill(""); values[0] = d.clave; values[1] = d.coords;
  let missing = null;
  $("#form").querySelectorAll("[data-i]").forEach((el) => { const i = +el.dataset.i; values[i] = el.value.trim().replace(/\s+/g, " "); if (!missing && isRequired(S.columns[i]) && !values[i]) { missing = { el, h: S.columns[i] }; } });
  // FECHA y HORA: se llenan con los del momento solo si están en blanco (si ya traen dato, se conserva)
  S.columns.forEach((h, i) => { if (i < 2) return; const k = autoKind(h); if ((k === "fecha" || k === "hora") && !values[i]) values[i] = nowFor(k); });
  if (CONFIG.REQUIRE_COORDS && !d.coords) return toast("Falta tomar la coordenada", "err");
  if (missing) { missing.el.focus(); return toast(`Falta completar: ${missing.h}`, "err"); }
  if (CONFIG.REQUIRE_PHOTO && !d.photos.length) return toast("Agrega al menos una fotografía", "err");
  if (S.records.some((r) => r.clave === d.clave)) { d.clave = nextClave(); values[0] = d.clave; }

  btn.disabled = true;
  const jornada = S.jornada || today();
  const photos = d.photos.map((p, i) => ({ name: `${d.clave}_${i + 1}.jpg`, clave: d.clave, blob: p.blob, uploaded: false }));
  const rec = { clave: d.clave, values, jornada, savedAt: new Date().toISOString(), photos: photos.map((p) => p.name) };
  const m = d.clave.match(/(\d+)$/); const counters = { ...S.counters, [S.verifier.initials]: Math.max(S.counters[S.verifier.initials] || 0, m ? +m[1] : 0) };
  try {
    await new Promise((res, rej) => {
      const t = db.transaction(["records", "photos", "meta"], "readwrite");
      t.objectStore("records").add(rec); photos.forEach((p) => t.objectStore("photos").put(p));
      t.objectStore("meta").put(counters, "counters"); t.objectStore("meta").put(jornada, "jornada");
      t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error);
    });
    S.records.push(rec); S.counters = counters; S.jornada = jornada;
    toast(`Registro ${rec.clave} guardado`, "ok"); closeForm(); if (T.on) sendPing("on");
  } catch (err) { toast("No se pudo guardar: " + (err?.message || "error de almacenamiento"), "err"); }
  btn.disabled = false;
}

/* ------------------------------------------------------------------ */
/*  Lista y detalle                                                    */
/* ------------------------------------------------------------------ */
function openList() {
  const recs = [...S.records].reverse();
  $("#listBody").innerHTML = recs.length ? recs.map((r) => `<div class="row" data-c="${esc(r.clave)}" style="cursor:pointer"><div><b>${esc(r.clave)}</b><div class="muted">${esc(r.savedAt.slice(0, 10))} ${esc(new Date(r.savedAt).toTimeString().slice(0, 5))} · ${r.photos.length} foto(s)</div></div><span class="tag">${r.jornada === S.jornada ? "Jornada actual" : "Cerrada"}</span></div>`).join("") : `<p class="muted">Aún no hay registros.</p>`;
  $("#listBody").querySelectorAll("[data-c]").forEach((n) => (n.onclick = () => showRecord(n.dataset.c)));
  show("list");
}
async function showRecord(clave) {
  const r = S.records.find((x) => x.clave === clave);
  $("#recTitle").textContent = r.clave;
  $("#recBody").innerHTML = S.columns.map((h, i) => !h ? "" : `<dt>${esc(h)}</dt><dd>${esc(r.values[i]) || "—"}</dd>`).join("");
  const ph = await Promise.all(r.photos.map((n) => dbGet("photos", n)));
  $("#recPhotos").innerHTML = ph.filter(Boolean).map((p) => `<div class="thumb"><img src="${URL.createObjectURL(p.blob)}" alt=""><em>${esc(p.name)}</em></div>`).join("");
  $("#dlgRec").showModal();
}

/* ------------------------------------------------------------------ */
/*  Seguimiento en tiempo real (lo ve monitor.html)                    */
/* ------------------------------------------------------------------ */
const T = { on: false, watch: null, timer: null, wake: null, last: null, lastSent: 0, err: null, sentOk: null, errMsg: "" };
const trackAvailable = () => CONFIG.TRACKING_ENABLED && !!CONFIG.DRIVE_UPLOAD_URL && !!navigator.geolocation;

async function sendPing(status) {
  if (!CONFIG.DRIVE_UPLOAD_URL || !S.verifier || (status === "on" && !T.last)) return;
  const p = T.last || {};
  try {
    const r = await fetch(CONFIG.DRIVE_UPLOAD_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: CONFIG.DRIVE_TOKEN, action: "ping", id: S.verifier.initials, name: S.verifier.name, status,
        lat: p.lat, lng: p.lng, acc: p.acc, registros: jornadaRecords().length }) });
    const j = await r.json().catch(() => { throw new Error("RESP"); });
    if (!j.ok) throw new Error(j.error || "Error desconocido");
    T.lastSent = Date.now(); T.sentOk = true; T.errMsg = "";
  } catch (e) {
    T.sentOk = false; const m = String(e.message || e);
    T.errMsg = e instanceof TypeError ? "No hay conexión con el receptor (sin internet o URL incorrecta en config.js)."
      : m === "RESP" ? "Respuesta no válida: en Apps Script la implementación debe ser «Cualquier persona» y la URL terminar en /exec."
      : /Tipo de archivo|Nombre de archivo|Carpeta no v/i.test(m) ? "El receptor de Google NO está actualizado: pega el nuevo drive-receptor.gs y publica una Nueva versión."
      : /Token/i.test(m) ? "El token no coincide: DRIVE_TOKEN (config.js) debe ser igual a TOKEN (drive-receptor.gs)." : m;
  }
  updateTrackUI();
}
async function keepAwake() {
  try {
    if (CONFIG.TRACK_KEEP_SCREEN_ON && T.on && "wakeLock" in navigator && !T.wake) {
      T.wake = await navigator.wakeLock.request("screen"); T.wake.addEventListener("release", () => (T.wake = null));
    }
  } catch {}
}
function startTracking() {
  if (T.on || !trackAvailable() || !S.verifier) return;
  T.on = true; S.tracking = true; dbPut("meta", true, "tracking");
  T.watch = navigator.geolocation.watchPosition((p) => {
    const first = !T.last; T.err = null;
    T.last = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) };
    if (first) sendPing("on"); updateTrackUI();
  }, (e) => { T.err = e; updateTrackUI(); }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  T.timer = setInterval(() => sendPing("on"), Math.max(15, CONFIG.TRACK_INTERVAL_SEC) * 1000);
  keepAwake(); updateTrackUI();
}
const autoTrack = () => { if (!T.on && S.trackStopDay !== today()) startTracking(); };
async function stopTracking() {
  if (!T.on) return;
  navigator.geolocation.clearWatch(T.watch); clearInterval(T.timer); T.on = false; S.tracking = false;
  await dbPut("meta", false, "tracking"); S.trackStopDay = today(); await dbPut("meta", S.trackStopDay, "trackStopDay");
  try { await T.wake?.release(); } catch {} T.wake = null;
  await sendPing("off"); T.last = null; updateTrackUI();
}
function updateTrackUI() {
  const c = $("#trackCard"); if (!c) return; c.hidden = !trackAvailable(); if (c.hidden) return;
  const st = $("#trackState"), sub = $("#trackSub"), b = $("#btnTrack");
  b.hidden = true;
  if (!T.on) {
    const closed = S.trackStopDay === today();
    st.textContent = closed ? "📡 Jornada cerrada: ubicación detenida" : "📡 Ubicación NO compartida";
    sub.textContent = closed ? "Se activará de nuevo en tu próxima jornada." : "La central no ve tu posición."; b.textContent = "▶ Activar ubicación"; b.hidden = closed; return;
  }
  st.textContent = T.err ? "⚠ Sin ubicación" : "📡 Ubicación compartida con la central";
  sub.textContent = T.err ? (T.err.code === 1 ? "Permiso de ubicación denegado: actívalo en los ajustes del navegador para este sitio." : "Buscando señal GPS… sal a un lugar abierto.")
    : T.errMsg ? "⚠ No se pudo enviar: " + T.errMsg
    : T.lastSent ? "Último envío: " + new Date(T.lastSent).toTimeString().slice(0, 5) : "Obteniendo señal GPS…";
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && T.on) { keepAwake(); sendPing("on"); } });

/* ------------------------------------------------------------------ */
/*  Descargas, Drive y cierre de jornada                               */
/* ------------------------------------------------------------------ */
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
}
const fileBase = (suffix = "") => `${S.verifier.initials}_${S.jornada || today()}${suffix}`;
const rowsOf = (recs) => recs.map((r) => r.values);

function blobToB64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); }); }
async function driveUpload(folder, fileName, mimeType, blob) {
  let r;
  try {
    r = await fetch(CONFIG.DRIVE_UPLOAD_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: CONFIG.DRIVE_TOKEN, folder, fileName, mimeType, data: await blobToB64(blob) }) });
  } catch { throw new Error("No se pudo conectar con el receptor de Drive. Revisa DRIVE_UPLOAD_URL en config.js y que la implementación esté como «Cualquier persona»."); }
  const j = await r.json().catch(() => ({ ok: false, error: "Respuesta no válida del receptor (HTTP " + r.status + "). Revisa que la URL termine en /exec y que hayas publicado una nueva versión." }));
  if (!j.ok) throw new Error(j.error || "Error desconocido");
}

let closeState = null, closing = false;
async function closeJornada() {
  const recs = jornadaRecords();
  if (!recs.length) return toast("No hay registros en la jornada actual", "err");
  if (!confirm(`Se cerrará la jornada con ${recs.length} registro(s).\n¿Generar archivos y enviarlos?` + (CONFIG.CLEAR_ON_CLOSE ? "\n\nAl terminar se LIMPIARÁ la memoria de la app (registros y fotos). Quedan los archivos en Descargas y en Drive." : ""))) return;
  if (closing) return; closing = true;

  const dlg = $("#dlgClose"), log = $("#closeLog"), bar = $("#closeBar"), ok = $("#closeOk"), share = $("#closeShare");
  const say = (m) => { log.textContent += m + "\n"; log.scrollTop = log.scrollHeight; };
  log.textContent = ""; bar.style.width = "0"; ok.disabled = true; share.hidden = true; $("#closeDlX").hidden = true; $("#closeDlZ").hidden = true;
  $("#closeMsg").textContent = "No cierres la aplicación hasta que termine.";
  dlg.showModal(); dlg.oncancel = (e) => e.preventDefault();

  try {
    const n = (S.closed[S.jornada] || 0);
    const base = fileBase(n ? `_${n + 1}` : "");
    const xlsx = buildXlsx(S.columns, rowsOf(recs));
    const allPh = await dbAll("photos"); const set = new Set(recs.map((r) => r.clave));
    const photos = allPh.filter((p) => set.has(p.clave)).sort((a, b) => a.name.localeCompare(b.name));
    say(`Archivo: ${base}.xlsx (${recs.length} registros)`); say(`Fotografías: ${photos.length}`);

    // 1) copia local en el teléfono
    let photosZip = null;
    if (photos.length) {
      const files = []; for (const p of photos) files.push({ name: p.name, data: new Uint8Array(await p.blob.arrayBuffer()) });
      photosZip = zipStore(files);
    }
    // Botones propios: una descarga iniciada con un toque nunca es bloqueada por el navegador
    $("#closeDlX").hidden = false; $("#closeDlX").onclick = () => download(xlsx, base + ".xlsx");
    if (photosZip) { $("#closeDlZ").hidden = false; $("#closeDlZ").onclick = () => download(photosZip, base + "_fotos.zip"); }
    if (!closeState || closeState.base !== base) {
      try {
        download(xlsx, base + ".xlsx");
        if (photosZip) { await new Promise((r) => setTimeout(r, 1500)); download(photosZip, base + "_fotos.zip"); }
        say("✔ Descarga iniciada (carpeta Descargas)");
      } catch { say("⚠ El navegador bloqueó la descarga automática: usa los botones de abajo."); }
      closeState = { base };
    }
    bar.style.width = "20%";

    // 2) envío a Drive
    if (CONFIG.DRIVE_UPLOAD_URL) {
      if (!navigator.onLine) throw new Error("Sin conexión a internet. Conéctate y vuelve a pulsar «Cierre de jornada».");
      const folder = `${CONFIG.DRIVE_FOLDER}/${base}`;
      say(`Enviando a Drive (${CONFIG.DRIVE_EMAIL})…`);
      await driveUpload(folder, base + ".xlsx", XLSX_MIME, xlsx); say("✔ " + base + ".xlsx");
      const pend = photos.filter((p) => !p.uploaded);
      for (let i = 0; i < pend.length; i++) {
        await driveUpload(folder, pend[i].name, "image/jpeg", pend[i].blob);
        pend[i].uploaded = true; await dbPut("photos", pend[i]); say("✔ " + pend[i].name);
        bar.style.width = 20 + Math.round(((i + 1) / pend.length) * 80) + "%";
      }
      say("Envío completo ✔"); say("Si lo necesitas, aún puedes bajar los archivos con los botones de abajo.");
      $("#closeMsg").textContent = "Jornada cerrada y enviada a Drive.";
    } else {
      say("Drive no configurado: use «Compartir» para enviarlos manualmente.");
      $("#closeMsg").textContent = "Jornada cerrada. Si no ves los archivos en Descargas, pulsa los botones de abajo ANTES de cerrar esta ventana.";
      const test = [new File([xlsx], base + ".xlsx", { type: XLSX_MIME }), ...photos.map((p) => new File([p.blob], p.name, { type: "image/jpeg" }))];
      if (navigator.canShare?.({ files: test })) { share.hidden = false; share.onclick = () => navigator.share({ files: test, title: base }).catch(() => {}); }
    }
    bar.style.width = "100%";
    // Cierre ATÓMICO: guardar el Excel en la app, marcar la jornada como cerrada y limpiar, todo en una sola
    // transacción. Si algo falla no se cambia nada (la jornada sigue abierta y los datos intactos).
    const newClosed = { ...S.closed, [S.jornada]: n + 1 };
    await new Promise((res, rej) => {
      const t = db.transaction(["records", "photos", "archive", "meta"], "readwrite");
      t.objectStore("archive").put({ name: base + ".xlsx", blob: xlsx, savedAt: new Date().toISOString() });
      if (CONFIG.CLEAR_ON_CLOSE) { t.objectStore("records").clear(); t.objectStore("photos").clear(); }
      t.objectStore("meta").put(newClosed, "closed"); t.objectStore("meta").put(null, "jornada");
      t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error || new Error("La base de datos del teléfono canceló la operación"));
    });
    S.closed = newClosed; S.jornada = null; closeState = null;
    if (CONFIG.CLEAR_ON_CLOSE) { S.records = []; say("✔ Memoria de la aplicación limpiada"); }
    try { await stopTracking(); } catch {}
  } catch (err) {
    say("✖ " + (err && err.name && err.name !== "Error" ? err.name + ": " : "") + (err.message || err)); $("#closeMsg").textContent = "No se pudo completar. La jornada sigue abierta; puedes reintentar.";
  }
  ok.disabled = false; dlg.oncancel = null; closing = false;
  ok.onclick = () => { dlg.close(); goHome(); };
}

/* Registros que quedaron de jornadas ya cerradas (por ejemplo, un cierre que se interrumpió):
   se guarda su Excel en la app y se borran registros y fotos. */
async function purgeClosed() {
  const orphan = S.records.filter((r) => r.jornada !== S.jornada);
  if (!orphan.length) return 0;
  const groups = {}; orphan.forEach((r) => (groups[r.jornada] ||= []).push(r));
  const t = db.transaction(["records", "photos", "archive"], "readwrite");
  Object.keys(groups).forEach((j) => t.objectStore("archive").put({ name: `${S.verifier.initials}_${j}_recuperado.xlsx`, blob: buildXlsx(S.columns, rowsOf(groups[j])), savedAt: new Date().toISOString() }));
  orphan.forEach((r) => { t.objectStore("records").delete(r.clave); r.photos.forEach((n) => t.objectStore("photos").delete(n)); });
  await new Promise((res, rej) => { t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error); });
  S.records = S.records.filter((r) => r.jornada === S.jornada);
  return orphan.length;
}
async function canChangeStructure(msg) {
  if (jornadaRecords().length) { msg.textContent = "⚠ Hay una jornada abierta con registros. Primero usa «Cierre de jornada»."; return false; }
  const old = S.records.filter((r) => r.jornada !== S.jornada).length;
  if (old) {
    if (!confirm(`Hay ${old} registro(s) de jornadas ya cerradas guardados en la app.\nSu Excel se conserva (Descargar TODO) y se borrarán los registros y fotos de la app.\n¿Continuar?`)) { msg.textContent = "Cancelado."; return false; }
    await purgeClosed();
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Ajustes                                                            */
/* ------------------------------------------------------------------ */
function openSettings() {
  $("#cfgName").value = S.verifier.name; $("#cfgInit").value = S.verifier.initials; $("#cfgFileMsg").textContent = ""; $("#cfgFile").value = "";
  $("#dlgSet").showModal();
}
function initSettings() {
  $("#btnSettings").onclick = openSettings;
  $("#cfgSave").onclick = async () => {
    const name = $("#cfgName").value.trim().replace(/\s+/g, " "), ini = $("#cfgInit").value.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (name.length < 3 || ini.length < 2) return toast("Revisa nombre e iniciales", "err");
    S.verifier = { name, initials: ini }; await saveMeta(); $("#dlgSet").close(); toast("Datos actualizados", "ok"); goHome();
  };
  $("#cfgFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; const msg = $("#cfgFileMsg");
    if (!(await canChangeStructure(msg))) { e.target.value = ""; return; }
    handleExcelFile(f, "#setSheet", "#setSheetBox", msg, async (cols) => {
      if (!cols) return; if (nCols(cols) < 3) { msg.textContent = "⚠ El Excel debe tener al menos 3 columnas."; return; }
      S.columns = cols; await saveMeta(); msg.textContent = `✔ Estructura actualizada (${nCols(cols)} campos).`;
    });
  };
  $("#cfgDefault").onclick = async () => {
    const msg = $("#cfgFileMsg");
    if (!(await canChangeStructure(msg))) return;
    try {
      const r = await fetch(CONFIG.DEFAULT_EXCEL, { cache: "no-store" }); if (!r.ok) throw 0;
      handleExcelFile(await r.blob(), "#setSheet", "#setSheetBox", msg, async (cols) => { if (!cols) return; S.columns = cols; await saveMeta(); msg.textContent = `✔ Estructura recargada desde ${CONFIG.DEFAULT_EXCEL} (${nCols(cols)} campos).`; });
    } catch { msg.textContent = `⚠ No se encontró ${CONFIG.DEFAULT_EXCEL}.`; }
  };
  const exp = (recs, kind, name) => {
    if (!recs.length) return toast("No hay registros para exportar", "err");
    download(kind === "csv" ? buildCsv(S.columns, rowsOf(recs)) : buildXlsx(S.columns, rowsOf(recs)), name);
  };
  $("#cfgXlsx").onclick = () => exp(jornadaRecords(), "xlsx", fileBase() + ".xlsx");
  $("#cfgCsv").onclick = () => exp(jornadaRecords(), "csv", fileBase() + ".csv");
  $("#cfgPurge").onclick = async () => {
    const n = S.records.filter((r) => r.jornada !== S.jornada).length;
    if (!n) return toast("No hay registros de jornadas cerradas", "ok");
    if (!confirm(`Se borrarán ${n} registro(s) y sus fotos de jornadas ya cerradas. Su Excel queda guardado en la app.\nSi no los has descargado, pulsa Cancelar y usa «Descargar TODO» primero.`)) return;
    try { toast(`Se limpiaron ${await purgeClosed()} registro(s)`, "ok"); goHome(); } catch (err) { toast("No se pudo limpiar: " + (err.message || err), "err"); }
  };
  $("#cfgZip").onclick = async () => {
    const u8 = async (b) => new Uint8Array(await b.arrayBuffer()), files = [];
    for (const a of await dbAll("archive")) files.push({ name: "Excel/" + a.name, data: await u8(a.blob) });
    const groups = {}; S.records.forEach((r) => (groups[r.jornada] ||= []).push(r));
    for (const j of Object.keys(groups))
      files.push({ name: `Excel/${S.verifier.initials}_${j}_${j === S.jornada ? "EN_CURSO" : "EN_APP"}.xlsx`, data: await u8(buildXlsx(S.columns, rowsOf(groups[j]))) });
    for (const p of await dbAll("photos")) files.push({ name: "Fotos/" + p.name, data: await u8(p.blob) });
    if (!files.length) return toast("No hay archivos para descargar", "err");
    download(zipStore(files), `${S.verifier.initials}_TODO_${today()}.zip`); toast(`ZIP con ${files.length} archivo(s)`, "ok");
  };
}

/* ------------------------------------------------------------------ */
/*  Arranque                                                           */
/* ------------------------------------------------------------------ */
async function boot() {
  document.title = CONFIG.APP_NAME; $("#cfgDefault").textContent = `Recargar estructura desde ${CONFIG.DEFAULT_EXCEL || "el Excel por omisión"}`; $("#cfgDefault").hidden = !CONFIG.DEFAULT_EXCEL;
  $("#appName").textContent = CONFIG.APP_NAME; $("#appSub").textContent = CONFIG.APP_SUBTITLE;
  $("#logo").src = CONFIG.LOGO;
  document.querySelector('meta[name="theme-color"]').content = CONFIG.THEME_COLOR;
  document.documentElement.style.setProperty("--brand", CONFIG.THEME_COLOR);
  addEventListener("online", netChip); addEventListener("offline", netChip); netChip();

  try { db = await openDB(); await loadState(); }
  catch { document.querySelector("main").innerHTML = '<div class="card"><h2>Almacenamiento no disponible</h2><p>Esta aplicación necesita guardar datos en el navegador. Sal del modo incógnito o abre la app desde Chrome/Safari.</p></div>'; return; }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  initSettings();
  $("#btnNew").onclick = openForm; $("#btnList").onclick = openList; $("#btnListBack").onclick = goHome; $("#btnClose").onclick = closeJornada;
  $("#btnSave").onclick = saveRecord;
  $("#btnTrack").onclick = () => { T.err = null; startTracking(); };   // no hay botón para pausar: solo se detiene al cerrar la jornada
  $("#btnCancel").onclick = () => { if (!formDirty() || confirm("¿Descartar este registro? Se perderán los datos capturados.")) closeForm(); };

  if (!S.columns.length || !S.verifier) initSetup(); else { goHome(); autoTrack(); }
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
