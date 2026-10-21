import ExcelJS from 'exceljs';

export interface TablaParaExcel {
  titulo: string;
  columnas: string[];
  filas: Record<string, unknown>[];
}

const esMonto = (columna: string) => columna.endsWith('_centavos');
const encabezado = (columna: string) =>
  columna.replace(/_centavos$/, ' (Bs)').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Arma el .xlsx de un reporte: montos en bolivianos con formato boliviano y encabezados legibles. */
export async function generarExcel(tabla: TablaParaExcel): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Abasto';
  const hoja = libro.addWorksheet(tabla.titulo.slice(0, 31) || 'Reporte');

  hoja.columns = tabla.columnas.map((c) => ({
    header: encabezado(c),
    key: c,
    width: Math.max(14, encabezado(c).length + 4),
    style: esMonto(c) ? { numFmt: '#,##0.00' } : {},
  }));
  hoja.getRow(1).font = { bold: true };

  for (const fila of tabla.filas) {
    hoja.addRow(
      Object.fromEntries(
        tabla.columnas.map((c) => [c, esMonto(c) ? Number(fila[c] ?? 0) / 100 : fila[c]]),
      ),
    );
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}
