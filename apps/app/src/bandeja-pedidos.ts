import { Bandeja, enviarAConecta, type Almacen, type OperacionLocal } from '@abasto/bandeja';
import * as Crypto from 'expo-crypto';
import { URLS } from './config';
import { guardado } from './guardado';
import { tokenActual } from './sesion';

/**
 * Los pedidos salen por una bandeja: con señal se mandan enseguida, sin señal esperan en el teléfono
 * con su clave única. Conecta nunca registra dos veces la misma clave aunque se reintente.
 * Es la Bandeja de packages/outbox-offline guardada con AsyncStorage (anda en Android, iPhone y la vista web).
 */
export class AlmacenEnTelefono implements Almacen {
  private static readonly CLAVE = 'bandeja';

  async guardar(op: OperacionLocal) {
    const otras = (await this.todas()).filter((o) => o.clave !== op.clave);
    await guardado.escribir(AlmacenEnTelefono.CLAVE, [...otras, op]);
  }

  async todas(): Promise<OperacionLocal[]> {
    return (await guardado.leer<OperacionLocal[]>(AlmacenEnTelefono.CLAVE)) ?? [];
  }
}

export const bandeja = new Bandeja(
  new AlmacenEnTelefono(),
  enviarAConecta(URLS.conecta, async () => (await tokenActual()) ?? ''),
  { generarClave: () => Crypto.randomUUID() },
);
