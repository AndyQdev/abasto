/** Lo que espera una decisión del mayorista: va en la campana del header y en «Alertas» del dock. */
export const LO_QUE_ESPERA = `
  query LoQueEspera {
    misVentas(estado: POR_CONFIRMAR) { id codigo creadoEn total { texto } tienda { nombre } }
    misSolicitudes { estado tienda { id nombre } }
  }`;

export interface DatosDeAlertas {
  misVentas?: { id: string; codigo: string; creadoEn: string; total: { texto: string }; tienda: { nombre?: string | null } }[] | null;
  misSolicitudes?: { estado: string; tienda: { id: string; nombre: string } }[] | null;
}

export interface Alerta {
  id: string;
  tono: 'ambar' | 'lima';
  titulo: string;
  detalle: string;
  ruta: string;
}

/** «hace 5 min», «hace 2 h», «hace 3 días» */
export function haceCuanto(fecha: string, ahora = Date.now()): string {
  const minutos = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Primero los pedidos por confirmar (el más viejo arriba: es el que vence antes), después las tiendas que piden ser clientes. */
export function armarAlertas(datos: DatosDeAlertas, ahora = Date.now()): Alerta[] {
  const pedidos = [...(datos.misVentas ?? [])]
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
    .map<Alerta>((p) => ({
      id: `pedido-${p.id}`,
      tono: 'ambar',
      titulo: `Confirma ${p.codigo}`,
      detalle: `${p.tienda.nombre ?? 'Una tienda'} · ${p.total.texto} · ${haceCuanto(p.creadoEn, ahora)}`,
      ruta: `pedidos?q=${encodeURIComponent(p.codigo)}`,
    }));
  const solicitudes = (datos.misSolicitudes ?? [])
    .filter((s) => s.estado === 'SOLICITADA')
    .map<Alerta>((s) => ({
      id: `cliente-${s.tienda.id}`,
      tono: 'lima',
      titulo: `${s.tienda.nombre} quiere comprarte`,
      detalle: 'Apruébala con una lista de precios',
      ruta: 'clientes',
    }));
  return [...pedidos, ...solicitudes];
}
