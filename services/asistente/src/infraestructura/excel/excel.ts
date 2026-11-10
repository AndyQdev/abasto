import ExcelJS from 'exceljs';

export interface TablaParaExcel {
  titulo: string;
  columnas: string[];
  filas: Record<string, unknown>[];
}

const esMonto = (columna: string) => columna.endsWith('_centavos');
const encabezado = (columna: string) =>
  columna.replace(/_centavos$/, ' (Bs)').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Excel no deja estos caracteres en el nombre de una hoja, ni más de 31 letras, ni dos hojas con el mismo nombre. */
function nombreDeHoja(titulo: string, usados: Set<string>): string {
  const base = titulo.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Reporte';
  let nombre = base;
  for (let n = 2; usados.has(nombre.toLowerCase()); n++) nombre = `${base} ${n}`;
  usados.add(nombre.toLowerCase());
  return nombre;
}

/**
 * Arma el .xlsx de un reporte: montos en bolivianos con formato boliviano y encabezados legibles.
 * Un reporte de varios bloques lleva una hoja por bloque.
 */
export async function generarExcel(...tablas: TablaParaExcel[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Abasto';
  const usados = new Set<string>();

  for (const tabla of tablas) {
    const hoja = libro.addWorksheet(nombreDeHoja(tabla.titulo, usados));
    hoja.columns = tabla.columnas.map((c) => ({
      header: encabezado(c),
      key: c,
      width: Math.max(14, encabezado(c).length + 4),
      style: esMonto(c) ? { numFmt: '#,##0.00' } : {},
    }));
    hoja.getRow(1).font = { bold: true };

    for (const fila of tabla.filas) {
      hoja.addRow(Object.fromEntries(tabla.columnas.map((c) => [c, esMonto(c) ? Number(fila[c] ?? 0) / 100 : fila[c]])));
    }
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}
