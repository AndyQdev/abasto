import type { MensajesProcesados, Outbox } from '../dominio/cobro-qr.repositorio.js';
import { ErrorDeDominio } from '../dominio/errores.js';
import type { AutorizarCredito, LiberarCredito } from './autorizar-credito.js';
import type { DevolverQr, GenerarQr } from './cobros-qr.js';

/** Un comando de la saga tal como llega de la cola cobros.comandos (contracts/asyncapi.yaml). */
export interface Comando {
  id: string;
  tipo: string;
  datos: { pedidoId: string; tiendaId: string; mayoristaId: string; centavos?: number };
}

export type Resultado = 'atendido' | 'repetido' | 'rechazado' | 'desconocido';

/**
 * Atiende los comandos de la saga de compra que manda Pedidos:
 * - cobros.autorizar_credito → cobro.credito_autorizado o cobro.rechazado
 * - cobros.generar_qr → crea el QR y avisa cobro.qr_generado (la app de la tienda lo muestra); cuando paga sale cobro.qr_pagado
 * - cobros.liberar_credito → cobro.credito_liberado
 * - cobros.devolver_qr → cobro.qr_devuelto
 * Si el dominio no deja cobrar, la saga recibe cobro.rechazado con el motivo y Pedidos libera el stock.
 */
export class AtenderComando {
  constructor(
    private readonly casos: {
      autorizarCredito: AutorizarCredito;
      liberarCredito: LiberarCredito;
      generarQr: GenerarQr;
      devolverQr: DevolverQr;
    },
    private readonly outbox: Outbox,
    private readonly procesados: MensajesProcesados,
  ) {}

  async ejecutar(comando: Comando): Promise<Resultado> {
    if (await this.procesados.yaProcesado(comando.id)) return 'repetido';
    const resultado = await this.aplicar(comando);
    await this.procesados.marcar(comando.id);
    return resultado;
  }

  private async aplicar({ tipo, datos }: Comando): Promise<Resultado> {
    const ref = { pedidoId: datos.pedidoId, tiendaId: datos.tiendaId, mayoristaId: datos.mayoristaId };
    try {
      switch (tipo) {
        case 'cobros.autorizar_credito':
          await this.casos.autorizarCredito.ejecutar({ ...ref, centavos: datos.centavos ?? 0 });
          return 'atendido';
        case 'cobros.generar_qr': {
          const { cobro, nuevo } = await this.casos.generarQr.ejecutar({ ...ref, centavos: datos.centavos ?? 0 });
          if (nuevo) await this.outbox.agregar({ tipo: 'cobro.qr_generado', ...ref, centavos: cobro.monto.centavos, venceEn: cobro.venceEn.toISOString() });
          return 'atendido';
        }
        case 'cobros.liberar_credito':
          await this.casos.liberarCredito.ejecutar(ref);
          return 'atendido';
        case 'cobros.devolver_qr':
          await this.casos.devolverQr.ejecutar(datos.pedidoId);
          return 'atendido';
        default:
          return 'desconocido';
      }
    } catch (e) {
      // Un error de negocio no se reintenta: se le avisa a la saga para que deshaga lo anterior
      if (!(e instanceof ErrorDeDominio)) throw e;
      await this.outbox.agregar({ tipo: 'cobro.rechazado', ...ref, motivo: e.message });
      return 'rechazado';
    }
  }
}
