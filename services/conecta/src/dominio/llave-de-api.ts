import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * CU-10: la llave con la que el e-commerce de una tienda entra a Conecta sin nadie al lado.
 * Texto: abk_<id>_<secreto>. El secreto se muestra una sola vez; aquí solo queda su huella.
 */
export interface LlaveDeApi {
  id: string;
  orgId: string;
  nombre: string;
  huella: string;
  /** Los últimos caracteres, para reconocerla en la lista */
  termina: string;
  creadaEn: string;
  ultimoUsoEn: string | null;
}

export type LlaveVisible = Omit<LlaveDeApi, 'huella'>;

export const MAXIMO_DE_LLAVES = 5;
const PREFIJO = 'abk_';

export const esLlave = (texto: string) => texto.startsWith(PREFIJO);

export function nuevaLlave(): { id: string; secreto: string; texto: string } {
  const id = randomBytes(6).toString('hex');
  const secreto = randomBytes(24).toString('base64url').replaceAll('_', 'x');
  return { id, secreto, texto: `${PREFIJO}${id}_${secreto}` };
}

export function leerLlave(texto: string): { id: string; secreto: string } | null {
  const m = /^abk_([0-9a-f]{12})_([A-Za-z0-9-]{20,})$/.exec(texto);
  return m ? { id: m[1]!, secreto: m[2]! } : null;
}

export const huellaDelSecreto = (secreto: string) => createHash('sha256').update(secreto).digest('hex');

export function coincide(secreto: string, huella: string): boolean {
  const a = Buffer.from(huellaDelSecreto(secreto), 'hex');
  const b = Buffer.from(huella, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function nombreDeLlave(nombre: unknown): string {
  const limpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (limpio.length < 2 || limpio.length > 60) {
    throw new ErrorDeIntegracion('NOMBRE_INVALIDO', 'Ponle un nombre de 2 a 60 letras, por ejemplo «Mi WooCommerce»');
  }
  return limpio;
}

/** Errores que se le muestran a quien conecta su tienda. */
export class ErrorDeIntegracion extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeIntegracion';
  }
}
