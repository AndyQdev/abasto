import {
  coincide,
  ErrorDeIntegracion,
  huellaDelSecreto,
  leerLlave,
  MAXIMO_DE_LLAVES,
  nombreDeLlave,
  nuevaLlave,
  type LlaveDeApi,
  type LlaveVisible,
} from '../dominio/llave-de-api.js';
import type { CuentasDeIntegracion, RegistroDeLlaves } from '../dominio/puertos.js';

const visible = ({ huella: _huella, ...resto }: LlaveDeApi): LlaveVisible => resto;
/** El token se renueva antes de vencer, y el último uso no se escribe en cada llamada. */
const MARGEN_DEL_TOKEN_MS = 30_000;
const CADA_CUANTO_ANOTAR_USO_MS = 60_000;

/**
 * CU-10: la tienda saca llaves para su e-commerce y las revoca. Cada llave tiene su cuenta de servicio en Keycloak
 * con el org_id de la tienda y su rol: Pedidos y Catálogo la tratan igual que a la tienda en la app.
 * Conecta guarda solo la huella; el secreto vive en quien lo recibió y en Keycloak.
 */
export class LlavesDeApi {
  private readonly tokens = new Map<string, { token: string; venceEn: number }>();

  constructor(
    private readonly registro: RegistroDeLlaves,
    private readonly cuentas: CuentasDeIntegracion,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async crear(orgId: string, nombre: unknown): Promise<{ llave: string; datos: LlaveVisible }> {
    const limpio = nombreDeLlave(nombre);
    const suyas = await this.registro.deOrganizacion(orgId);
    if (suyas.length >= MAXIMO_DE_LLAVES) {
      throw new ErrorDeIntegracion('DEMASIADAS_LLAVES', `Puedes tener ${MAXIMO_DE_LLAVES} llaves. Revoca una que ya no uses.`);
    }
    const { id, secreto, texto } = nuevaLlave();
    await this.cuentas.crear(id, secreto, orgId);
    const llave: LlaveDeApi = {
      id,
      orgId,
      nombre: limpio,
      huella: huellaDelSecreto(secreto),
      termina: secreto.slice(-4),
      creadaEn: this.reloj().toISOString(),
      ultimoUsoEn: null,
    };
    try {
      await this.registro.guardar(llave);
    } catch (e) {
      await this.cuentas.borrar(id).catch(() => undefined);
      throw e;
    }
    return { llave: texto, datos: visible(llave) };
  }

  async delaOrganizacion(orgId: string): Promise<LlaveVisible[]> {
    return (await this.registro.deOrganizacion(orgId)).map(visible);
  }

  async todas(): Promise<LlaveVisible[]> {
    return (await this.registro.todas()).map(visible);
  }

  /** La llave deja de servir al momento: autenticar la busca en cada llamada. */
  async revocar(orgId: string, id: string): Promise<void> {
    const llave = await this.registro.porId(id);
    if (!llave || llave.orgId !== orgId) throw new ErrorDeIntegracion('LLAVE_NO_EXISTE', 'Esa llave no existe o ya fue revocada');
    await this.registro.borrar(id);
    this.tokens.delete(id);
    await this.cuentas.borrar(id);
  }

  /** El token de Keycloak de esa llave, o null si no vale. */
  async autenticar(texto: string): Promise<string | null> {
    const leida = leerLlave(texto);
    if (!leida) return null;
    const llave = await this.registro.porId(leida.id);
    if (!llave || !coincide(leida.secreto, llave.huella)) return null;

    const ahora = this.reloj();
    void this.anotarUso(llave, ahora);
    const guardado = this.tokens.get(llave.id);
    if (guardado && guardado.venceEn - MARGEN_DEL_TOKEN_MS > ahora.getTime()) return guardado.token;
    const { token, venceEnSegundos } = await this.cuentas.token(llave.id, leida.secreto);
    this.tokens.set(llave.id, { token, venceEn: ahora.getTime() + venceEnSegundos * 1000 });
    return token;
  }

  private async anotarUso(llave: LlaveDeApi, ahora: Date) {
    const anterior = llave.ultimoUsoEn ? new Date(llave.ultimoUsoEn).getTime() : 0;
    if (ahora.getTime() - anterior < CADA_CUANTO_ANOTAR_USO_MS) return;
    await this.registro.anotarUso(llave.id, ahora.toISOString()).catch(() => undefined);
  }
}
