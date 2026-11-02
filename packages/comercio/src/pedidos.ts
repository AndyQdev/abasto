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
    /** `centavos` desde el 01/11 (lo usa el inventario de «Mi negocio» para el costo) */
    subtotal: { texto: string; centavos?: number };
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
  lineas { presentacion cantidad unidades producto { id nombre rubro } subtotal { centavos texto } }
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
    // Mientras se prepara o va en camino, ese paso está en curso (late en la app), no hecho
    { nombre: 'En preparación', nodo: p.estado === 'EN_PREPARACION' ? 'proc' : llego('EN_PREPARACION') ? 'hecho' : 'pend' },
    { nombre: 'En camino', nodo: p.estado === 'DESPACHADO' ? 'proc' : llego('DESPACHADO') ? 'hecho' : 'pend' },
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

/**
 * El paso en el que va el pedido (02/11, Compras): el que está en proceso o, si ninguno, el siguiente pendiente (lo que
 * viene). -1 si ya terminó o no siguió. Es el que se anima en la línea de tiempo.
 */
export function pasoActual(pasos: Paso[]): number {
  const enProceso = pasos.findIndex((x) => x.nodo === 'proc');
  if (enProceso >= 0) return enProceso;
  if (pasos.some((x) => x.nodo === 'rojo')) return -1;
  return pasos.findIndex((x) => x.nodo === 'pend');
}

/** El pago por QR es el paso que muestra el QR ahí mismo */
export const esPasoDePagoQr = (x: Paso) => x.nombre === 'Pago por QR';

/** Ya no cambia: entregado, rechazado o cancelado */
export const terminado = (p: Pick<Pedido, 'estado'>) => p.estado === 'ENTREGADO' || p.estado === 'RECHAZADO' || p.estado === 'CANCELADO';

/** Lo que se lee arriba del seguimiento, en grande: qué pasa ahora y qué sigue */
export function titularDelPedido(p: Pick<Pedido, 'estado' | 'metodoPago' | 'cobro' | 'total'>): { titulo: string; detalle: string } {
  switch (p.estado) {
    case 'PENDIENTE':
      if (p.total.centavos === 0) return { titulo: 'Reservando tu pedido', detalle: p.metodoPago === 'QR' ? 'En un momento te mostramos el QR para pagar' : 'Apartamos lo que pediste' };
      if (porPagar(p)) return { titulo: 'Paga para que lo preparemos', detalle: 'Escanea el QR con la app de tu banco' };
      return { titulo: p.metodoPago === 'CREDITO' ? 'Autorizando tu crédito' : 'Procesando tu pedido', detalle: 'Es cuestión de segundos' };
    case 'POR_CONFIRMAR':
      return { titulo: 'El vendedor revisa tu pedido', detalle: 'Te avisamos apenas lo confirme' };
    case 'CONFIRMADO':
      return { titulo: '¡Confirmado!', detalle: 'Pronto empiezan a prepararlo' };
    case 'EN_PREPARACION':
      return { titulo: 'Estamos preparando tu pedido', detalle: 'Juntamos todo lo que pediste' };
    case 'DESPACHADO':
      return { titulo: 'Tu pedido va en camino', detalle: p.metodoPago === 'CONTRA_ENTREGA' ? `Ten listos ${p.total.texto} para pagar al recibir` : 'Llega a la dirección que elegiste' };
    case 'ENTREGADO':
      return { titulo: '¡Entregado!', detalle: 'Ya entró a tu inventario de «Mi negocio»' };
    default:
      return { titulo: 'Tu pedido no siguió', detalle: 'Mira abajo qué deshicimos por ti' };
  }
}

/** Para la tarjeta de Compras: cuántos pasos van y cuál es el actual */
export function progresoDelPedido(p: Pick<Pedido, 'estado' | 'metodoPago' | 'cobro' | 'total' | 'motivoRechazo'>) {
  const pasos = lineaDeTiempo(p);
  return { pasos, hechos: pasos.filter((x) => x.nodo === 'hecho').length, actual: pasoActual(pasos) };
}
