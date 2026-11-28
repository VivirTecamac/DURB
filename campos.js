/* =====================================================================
   CAMPOS DEL FORMULARIO  —  EDITA SOLO ESTE ARCHIVO PARA CAMBIAR CÓMO SE CAPTURA CADA CAMPO
   =====================================================================
   Cada línea es un campo. «campo» es el ENCABEZADO de la columna del Excel (no importan
   mayúsculas ni espacios al final). Lo que no esté aquí se captura como texto simple.

   tipo:
     "texto"     -> una línea de texto (por omisión)
     "area"      -> cuadro de texto grande
     "numero"    -> solo números
     "fecha"     -> selector de fecha
     "telefono"  -> teclado numérico de teléfono
     "lista"     -> lista desplegable: SOLO se puede elegir una de las «opciones»
     "combo"     -> lista desplegable con «opciones» + la posibilidad de escribir OTRO texto

   opciones: textos de la lista (para "lista" y "combo").

   Ejemplo para agregar un campo nuevo:
     { campo: "NOMBRE DEL ENCABEZADO", tipo: "combo", opciones: ["Sí", "No"] },
   ===================================================================== */
const CAMPOS = [
  { campo: "RECIBE", tipo: "combo", opciones: ["No atiende", "No se identifica", "Se fija por instructivo"] },
  { campo: "NARRACIÓN OBJETIVA DE HECHOS Y MOTIVOS:", tipo: "area" },
];
