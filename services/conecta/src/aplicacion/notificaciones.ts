import { randomUUID } from 'node:crypto';
import type { SobreDeEvento } from '../dominio/aviso-de-pedido.js';
import { ErrorDeIntegracion } from '../dominio/llave-de-api.js';
import {
  notificacionDePedido,
  notificacionDePromocion,
  validarDispositivo,
  validarPromocion,
  type Dispositivo,
  type EntradaDePromocion,
  type Notificacion,
  type Promocion,
  type ResultadoDeEnvio,
} from '../dominio/notificacion.js';
import type { EnviadorDeNotificaciones, RegistroDeAvisos, RegistroDeDispositivos, RegistroDePromociones } from '../dominio/puertos.js';

/** Quien registra su teléfono: una persona con sesión de una empresa. */
export interface Quien {
  id: string;
  orgId: string;
}

/** Lo último que salió, para el Superadmin y las pruebas. Vive en memoria: es para mirar, no un registro. */
export interface EnvioReciente {
  cuando: string;
  orgId: string;
  titulo: string;
  cuerpo: string;
  canal: Notificacion['canal'];
  datos: Record<string, string>;
  resultado: ResultadoDeEnvio;
}

const RECIENTES = 50;
/** Firebase acepta muchos pedidos a la vez; diez en paralelo manda rápido sin que una promoción tape todo. */
const EN_PARALELO = 10;

export class Notificaciones {
  private readonly recientes: EnvioReciente[] = [];

  constructor(
    private readonly dispositivos: RegistroDeDispositivos,
    private readonly enviador: EnviadorDeNotificaciones,
    private readonly promociones: RegistroDePromociones,
    private readonly avisos: RegistroDeAvisos,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  /** El teléfono avisa su token al entrar (y cada vez que Firebase se lo cambia). Si era de otra cuenta, pasa a esta. */
  async registrar(quien: Quien, entrada: { token?: unknown; plataforma?: unknown }): Promise<Dispositivo> {
    if (!quien.orgId) throw new ErrorDeIntegracion('SIN_EMPRESA', 'Tu sesión no tiene una empresa');
    const { token, plataforma } = validarDispositivo(entrada);
    const antes = await this.dispositivos.porToken(token);
    const cuando = this.ahora().toISOString();
    const dispositivo: Dispositivo = {
      token,
      plataforma,
      orgId: quien.orgId,
      usuarioId: quien.id,
      registradoEn: antes && antes.orgId === quien.orgId ? antes.registradoEn : cuando,
      actualizadoEn: cuando,
    };
    await this.dispositivos.guardar(dispositivo);
    return dispositivo;
  }

  /** Al cerrar sesión el teléfono deja de recibir lo de esa tienda. Solo lo puede quitar su misma empresa. */
  async quitar(quien: Quien, token: string): Promise<void> {
    const d = await this.dispositivos.porToken(token);
    if (d && d.orgId === quien.orgId) await this.dispositivos.quitar(token);
  }

  /** Un pedido cambió: avisa a los teléfonos de la tienda. Devuelve a cuántos se mandó. */
  async avisarEvento(sobre: SobreDeEvento): Promise<number> {
    const aviso = notificacionDePedido(sobre);
    if (!aviso) return 0;
    if (sobre.id && !(await this.avisos.primeraVez(sobre.id))) return 0;
    const telefonos = await this.dispositivos.deOrganizacion(aviso.tiendaId);
    const resultados = await this.mandarATodos(telefonos, aviso.notificacion);
    return resultados.filter((r) => r === 'enviada').length;
  }

  /** Para probar desde la app: «Probar notificación» le manda una a los teléfonos de quien la pide. */
  async probar(quien: Quien): Promise<{ telefonos: number; enviadas: number }> {
    const telefonos = await this.dispositivos.deOrganizacion(quien.orgId);
    const resultados = await this.mandarATodos(telefonos, {
      titulo: 'Las notificaciones funcionan',
      cuerpo: 'Así te vamos a avisar cuando confirmen tu pedido, salga en camino y llegue.',
      canal: 'pedidos',
      etiqueta: 'prueba',
      datos: { tipo: 'prueba' },
    });
    return { telefonos: telefonos.length, enviadas: resultados.filter((r) => r === 'enviada').length };
  }

  /**
   * CU nuevo: Abasto manda una promoción a todos los teléfonos con la app. El id es el Idempotency-Key: si el
   * Superadmin la manda dos veces (doble clic, se cortó la red), sale una sola vez y responde la misma.
   */
  async crearPromocion(admin: Quien, clave: string, entrada: EntradaDePromocion): Promise<Promocion> {
    const { titulo, mensaje, productoId } = validarPromocion(entrada);
    const promocion: Promocion = {
      id: clave || randomUUID(),
      titulo,
      mensaje,
      productoId,
      creadaPor: admin.id,
      creadaEn: this.ahora().toISOString(),
      destinatarios: 0,
      enviadas: 0,
      fallidas: 0,
    };
    if (!(await this.promociones.crearSiNoExiste(promocion))) {
      return (await this.promociones.porId(promocion.id)) ?? promocion;
    }
    const telefonos = await this.dispositivos.todos();
    const resultados = await this.mandarATodos(telefonos, notificacionDePromocion(promocion));
    const final: Promocion = {
      ...promocion,
      destinatarios: telefonos.length,
      enviadas: resultados.filter((r) => r === 'enviada').length,
      fallidas: resultados.filter((r) => r !== 'enviada').length,
    };
    await this.promociones.actualizar(final);
    return final;
  }

  ultimasPromociones(): Promise<Promocion[]> {
    return this.promociones.ultimas(30);
  }

  /** Lo que ve el Superadmin: cuántos teléfonos y tiendas, si Firebase está conectado y lo último que salió. */
  async resumen() {
    const telefonos = await this.dispositivos.todos();
    return {
      modo: this.enviador.modo,
      telefonos: telefonos.length,
      empresas: new Set(telefonos.map((t) => t.orgId)).size,
      recientes: [...this.recientes],
    };
  }

  private async mandarATodos(telefonos: Dispositivo[], n: Notificacion): Promise<ResultadoDeEnvio[]> {
    const resultados: ResultadoDeEnvio[] = Array.from({ length: telefonos.length });
    let siguiente = 0;
    const trabajar = async () => {
      while (siguiente < telefonos.length) {
        const i = siguiente++;
        resultados[i] = await this.mandar(telefonos[i], n);
      }
    };
    await Promise.all(Array.from({ length: Math.min(EN_PARALELO, telefonos.length) }, trabajar));
    return resultados;
  }

  private async mandar(d: Dispositivo, n: Notificacion): Promise<ResultadoDeEnvio> {
    let resultado: ResultadoDeEnvio;
    try {
      resultado = await this.enviador.enviar(d.token, n);
    } catch {
      resultado = 'fallida';
    }
    // Firebase dice que ese token ya no existe (desinstalaron la app): se borra para no insistir
    if (resultado === 'token-invalido') await this.dispositivos.quitar(d.token).catch(() => undefined);
    this.recientes.unshift({ cuando: this.ahora().toISOString(), orgId: d.orgId, titulo: n.titulo, cuerpo: n.cuerpo, canal: n.canal, datos: n.datos, resultado });
    this.recientes.length = Math.min(this.recientes.length, RECIENTES);
    return resultado;
  }
}
