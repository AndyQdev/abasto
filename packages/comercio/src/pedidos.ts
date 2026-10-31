/**
 * Mis pedidos y su seguimiento. La saga corre en los servicios (Pedidos → Catálogo → Cobros → mayorista);
 * aquí solo se traduce su estado a pasos que la tienda entiende.
 */
export type EstadoPedido =
  | 'PENDIENTE'
  | 'POR_CONFIRMAR'
  | 'CONFIRMADO'
  | 'EN_PREPARACION'
  | 'DESPACHADO'
  | 'ENTREGADO'
  | 'RECHAZADO'
  | 'CANCELADO';

export type EstadoCobroQr = 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'DEVUELTO' | 'ANULADO';

export interface Pedido {
  id: string;
  codigo: string;
  estado: EstadoPedido;
  metodoPago: 'QR' | 'CREDITO' | 'CONTRA_ENTREGA';
  creadoEn: string;
  motivoRechazo: string | null;
  total: { centavos: number; texto: string };
  mayorista: { id: string; nombre?: string | null };
  lineas: {
    presentacion: string;
    cantidad: number;
    unidades: number;
    producto: { id: string; nombre?: string | null; rubro?: string | null };
    subtotal: { texto: string };
  }[];
  cobro: { estado: EstadoCobroQr; codigo: string; venceEn: string; monto: { texto: string } } | null;
  /** A dónde se lleva. Null en los pedidos sin dirección (e-commerce, n8n o anteriores al 31/10) */
  entrega?: DireccionDeEntrega | null;
}

export interface DireccionDeEntrega {
  calle: string;
  zona: string;
  referencia: string;
  latitud: number | null;
  longitud: number | null;
  texto: string;
}

const CAMPOS = `id codigo estado metodoPago creadoEn motivoRechazo total { centavos texto }
  mayorista { id nombre }
  lineas { presentacion cantidad unidades producto { id nombre rubro } subtotal { texto } }
  cobro { estado codigo venceEn monto { texto } }
  entrega { calle zona referencia latitud longitud texto }`;

export const MIS_COMPRAS = `query MisCompras { misCompras { ${CAMPOS} } }`;
export const UN_PEDIDO = `query Pedido($id: ID!) { pedido(id: $id) { ${CAMPOS} } }`;
export const PAGAR_QR_DE_PRUEBA = `mutation Pagar($id: ID!) { pagarQrDePrueba(pedidoId: $id) { estado } }`;

export type Clase = 'ins-verde' | 'ins-ambar' | 'ins-rojo' | 'ins-gris';

/** Lo que la tienda tiene que hacer o esperar, en una palabra */
export function estadoVisible(p: Pick<Pedido, 'estado' | 'metodoPago' | 'cobro' | 'total'>): { texto: string; clase: Clase } {
  switch (p.estado) {
    case 'PENDIENTE':
      if (p.total.centavos === 0) return { texto: 'Reservando', clase: 'ins-ambar' };
      if (p.metodoPago === 'QR' && p.cobro?.estado === 'PENDIENTE') return { texto: 'Por pagar', clase: 'ins-ambar' };
      return { texto: 'Procesando', clase: 'ins-ambar' };
    case 'POR_CONFIRMAR':
      return { texto: 'Esperando al mayorista', clase: 'ins-ambar' };
    case 'CONFIRMADO':
      return { texto: 'Confirmado', clase: 'ins-verde' };
    case 'EN_PREPARACION':
      return { texto: 'En preparación', clase: 'ins-verde' };
    case 'DESPACHADO':
      return { texto: 'En camino', clase: 'ins-verde' };
    case 'ENTREGADO':
      return { texto: 'Entregado', clase: 'ins-verde' };
    case 'RECHAZADO':
      return { texto: 'Rechazado', clase: 'ins-rojo' };
    case 'CANCELADO':
      return { texto: 'Cancelado', clase: 'ins-gris' };
  }
}

/** Se pide de nuevo cada pocos segundos mientras la saga sigue moviéndose */
export const enCurso = (p: Pick<Pedido, 'estado'>) => p.estado === 'PENDIENTE' || p.estado === 'POR_CONFIRMAR';

export const porPagar = (p: Pick<Pedido, 'estado' | 'metodoPago' | 'cobro'>) =>
  p.estado === 'PENDIENTE' && p.metodoPago === 'QR' && p.cobro?.estado === 'PENDIENTE';

export type FiltroDePedidos = 'todos' | 'en_curso' | 'entregados' | 'cancelados';

export function filtrarPedidos<T extends Pick<Pedido, 'estado'>>(pedidos: T[], filtro: FiltroDePedidos): T[] {
  if (filtro === 'en_curso') return pedidos.filter((p) => !['ENTREGADO', 'RECHAZADO', 'CANCELADO'].includes(p.estado));
  if (filtro === 'entregados') return pedidos.filter((p) => p.estado === 'ENTREGADO');
  if (filtro === 'cancelados') return pedidos.filter((p) => p.estado === 'RECHAZADO' || p.estado === 'CANCELADO');
  return pedidos;
}

export type Nodo = 'hecho' | 'proc' | 'pend' | 'rojo';

export interface Paso {
  nombre: string;
  detalle?: string;
  nodo: Nodo;
}

/**
 * Los pasos de la saga como los ve la tienda. Si algo falló, el paso que falló queda en rojo con el motivo
 * y los siguientes no se muestran: la pantalla agrega «Lo deshicimos por ti».
 */
export function lineaDeTiempo(p: Pick<Pedido, 'estado' | 'metodoPago' | 'cobro' | 'total' | 'motivoRechazo'>): Paso[] {
  // Contra entrega no hay paso de pago antes: se paga al recibir
  const contraEntrega = p.metodoPago === 'CONTRA_ENTREGA';
  const pago = p.metodoPago === 'QR' ? 'Pago por QR' : 'Crédito con el mayorista';
  const reservado = p.total.centavos > 0;
  const cobrado = contraEntrega || (p.metodoPago === 'QR' ? p.cobro?.estado === 'PAGADO' || p.cobro?.estado === 'DEVUELTO' : p.estado !== 'PENDIENTE');
  const orden: EstadoPedido[] = ['CONFIRMADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'];
  const llego = (e: EstadoPedido) => orden.indexOf(p.estado) >= orden.indexOf(e) && orden.includes(p.estado);

  if (p.estado === 'RECHAZADO' || p.estado === 'CANCELADO') {
    const motivo = p.motivoRechazo ?? 'Sin motivo';
    const pasos: Paso[] = [{ nombre: 'Pedido enviado', nodo: 'hecho' }];
    if (!reservado) return [...pasos, { nombre: 'Reserva del stock', detalle: motivo, nodo: 'rojo' }];
    pasos.push({ nombre: 'Stock reservado', nodo: 'hecho' });
    if (!cobrado) return [...pasos, { nombre: pago, detalle: motivo, nodo: 'rojo' }];
    if (!contraEntrega) pasos.push({ nombre: pago, nodo: 'hecho' });
    return [...pasos, { nombre: 'Confirmación del mayorista', detalle: motivo, nodo: 'rojo' }];
  }

  const pasoDePago: Paso[] = contraEntrega
    ? []
    : [
        {
          nombre: pago,
          detalle: !reservado ? undefined : cobrado ? undefined : p.metodoPago === 'QR' ? 'Esperando tu pago' : 'Autorizando el crédito',
          nodo: !reservado ? 'pend' : cobrado ? 'hecho' : 'proc',
        },
      ];
  return [
    { nombre: 'Pedido enviado', nodo: 'hecho' },
    { nombre: reservado ? 'Stock reservado' : 'Reservando el stock', nodo: reservado ? 'hecho' : 'proc' },
    ...pasoDePago,
    {
      nombre: 'Confirmación del mayorista',
      nodo: p.estado === 'POR_CONFIRMAR' ? 'proc' : llego('CONFIRMADO') ? 'hecho' : 'pend',
      detalle: p.estado === 'POR_CONFIRMAR' ? 'El mayorista revisa tu pedido' : undefined,
    },
    { nombre: 'En preparación', nodo: llego('EN_PREPARACION') ? 'hecho' : 'pend' },
    { nombre: 'En camino', nodo: llego('DESPACHADO') ? 'hecho' : 'pend' },
    {
      nombre: 'Entregado',
      detalle: contraEntrega && !llego('ENTREGADO') ? 'Pagas al recibir, en efectivo o QR' : undefined,
      nodo: llego('ENTREGADO') ? 'hecho' : 'pend',
    },
  ];
}

/** Qué se deshizo cuando el pedido no siguió: la tienda tiene que saber que no perdió nada. */
export function compensaciones(p: Pick<Pedido, 'estado' | 'metodoPago' | 'cobro' | 'total'>): string[] {
  if (p.estado !== 'RECHAZADO' && p.estado !== 'CANCELADO') return [];
  if (p.total.centavos === 0) return ['No se reservó nada ni se te cobró'];
  const lista = ['Liberamos la reserva del stock'];
  if (p.metodoPago === 'CONTRA_ENTREGA') lista.push('No se te cobró nada');
  else if (p.metodoPago === 'CREDITO') lista.push(`Te devolvimos ${p.total.texto} a tu crédito`);
  else if (p.cobro?.estado === 'DEVUELTO') lista.push(`Te devolvimos ${p.total.texto} de tu pago por QR`);
  else lista.push('No se te cobró nada');
  return lista;
}

/** «14:31» que queda para pagar el QR */
export function tiempoRestante(venceEn: string, ahora = Date.now()) {
  const ms = Math.max(0, new Date(venceEn).getTime() - ahora);
  const min = Math.floor(ms / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return `${min}:${String(seg).padStart(2, '0')}`;
}

/** «28/10/2026 23:33» */
export function fechaHora(iso: string) {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export const productos = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`;
