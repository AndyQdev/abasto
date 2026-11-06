import type { EntradaDeBitacora } from './bitacora.js';
import type { LlaveDeApi } from './llave-de-api.js';
import type { Operacion } from './operacion.js';
import type { Entrega, Webhook } from './webhook.js';

export type Reserva =
  | { tipo: 'nueva' }
  | { tipo: 'repetida'; respuesta: unknown }
  | { tipo: 'en_curso' }
  | { tipo: 'conflicto' };

/**
 * Puerto: registro de claves de idempotencia.
 * reservar() tiene que ser atómico: de 20 peticiones simultáneas con la misma clave, una sola recibe 'nueva'.
 */
export interface RegistroDeIdempotencia {
  reservar(clave: string, huella: string): Promise<Reserva>;
  completar(clave: string, respuesta: unknown): Promise<void>;
  /** Si el servicio de destino falló, se libera la clave para que el reintento pueda aplicarse. */
  liberar(clave: string): Promise<void>;
}

/** Puerto: a dónde va cada operación (Pedidos, Catálogo). */
export interface DestinoDeOperaciones {
  aplicar(operacion: Operacion, token: string): Promise<unknown>;
}

/** Puerto: la bitácora de lo que entró para cada mayorista (Panel › Conecta). */
export interface Bitacora {
  anotar(entrada: EntradaDeBitacora): Promise<void>;
  /** Lo último primero. */
  delMayorista(mayoristaId: string, limite: number): Promise<EntradaDeBitacora[]>;
}

/** Puerto (CU-10): dónde quedan las llaves de API. */
export interface RegistroDeLlaves {
  guardar(llave: LlaveDeApi): Promise<void>;
  porId(id: string): Promise<LlaveDeApi | null>;
  deOrganizacion(orgId: string): Promise<LlaveDeApi[]>;
  todas(): Promise<LlaveDeApi[]>;
  borrar(id: string): Promise<void>;
  anotarUso(id: string, cuando: string): Promise<void>;
}

/** Puerto (CU-10): la cuenta de Keycloak de cada llave, con la que el e-commerce actúa como su tienda. */
export interface CuentasDeIntegracion {
  crear(id: string, secreto: string, orgId: string): Promise<void>;
  borrar(id: string): Promise<void>;
  token(id: string, secreto: string): Promise<{ token: string; venceEnSegundos: number }>;
}

/** Puerto (CU-10): los webhooks de cada tienda y lo que se les entregó. */
export interface RegistroDeWebhooks {
  guardar(webhook: Webhook): Promise<void>;
  porId(id: string): Promise<Webhook | null>;
  deOrganizacion(orgId: string): Promise<Webhook[]>;
  todos(): Promise<Webhook[]>;
  borrar(id: string): Promise<void>;
  /** False si esa entrega ya existía: el evento se repitió. */
  crearEntrega(entrega: Entrega): Promise<boolean>;
  guardarEntrega(entrega: Entrega): Promise<void>;
  entregaPorId(id: string): Promise<Entrega | null>;
  entregasPorReintentar(hasta: string): Promise<Entrega[]>;
  /** Lo último primero. */
  entregasDe(orgId: string, limite: number): Promise<Entrega[]>;
  ultimasEntregas(limite: number): Promise<Entrega[]>;
}

/** Puerto (CU-10): hace el envío y decide a qué direcciones se puede mandar. */
export interface EntregadorDeWebhooks {
  motivoParaRechazar(url: string): Promise<string | null>;
  enviar(url: string, cuerpo: string, cabeceras: Record<string, string>): Promise<{ ok: boolean; error?: string }>;
}

/** Puerto (CU-10): lo que el e-commerce o el agente pueden leer, siempre con el token de la tienda. */
export interface ConsultasDeCompra {
  mayoristas(token: string, busqueda?: string): Promise<unknown[]>;
  productos(token: string, filtro: { busqueda?: string; mayoristaId?: string }): Promise<unknown[]>;
  pedido(token: string, id: string): Promise<unknown>;
  misCompras(token: string): Promise<unknown[]>;
}

export const CONSULTAS_DE_COMPRA = Symbol('ConsultasDeCompra');
export const REGISTRO_DE_LLAVES = Symbol('RegistroDeLlaves');
export const CUENTAS_DE_INTEGRACION = Symbol('CuentasDeIntegracion');
export const REGISTRO_DE_WEBHOOKS = Symbol('RegistroDeWebhooks');
export const ENTREGADOR_DE_WEBHOOKS = Symbol('EntregadorDeWebhooks');
export const REGISTRO_DE_IDEMPOTENCIA = Symbol('RegistroDeIdempotencia');
export const BITACORA = Symbol('Bitacora');
export const DESTINO_DE_OPERACIONES = Symbol('DestinoDeOperaciones');
