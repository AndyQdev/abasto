/**
 * Las operaciones con el servidor (docs/plan-mi-negocio.md, «Cómo se sincroniza»):
 * - Cobros (esquema `negocio`): `miNegocio(desde)` baja todo lo del cliente desde la marca; `sincronizarMiNegocio`
 *   sube la cola del teléfono. Los campos son los de `modelo.ts`, uno a uno.
 * - Catálogo: `miTipoDeNegocio` y `elegirTipoDeNegocio` (el tipo de negocio vive en la organización del cliente).
 */
import type { CambiosDeNegocio, DatosDeNegocio } from './modelo';

const CAMPOS = `
  articulos { id nombre detalle rubro medida { envase porEnvase unidad } clase origen productoId proveedor precioVentaCentavos stockMinimo creadoEn actualizadoEn eliminado }
  movimientos { id articuloId tipo cantidad costoUnitarioCentavos origen claveUnica fecha nota ventaId tandaId }
  ventas { id fecha lineas { articuloId cantidad precioUnitarioCentavos costoUnitarioCentavos } totalCentavos costoCentavos forma clienteId anulada }
  clientes { id nombre telefono creadoEn actualizadoEn eliminado }
  fiados { id clienteId tipo montoCentavos ventaId fecha nota }
  recetas { id articuloId nombre rinde notas insumos { articuloId cantidad } actualizadoEn eliminado }
  tandas { id recetaId articuloId planificado obtenido costoTotalCentavos fecha }
  anotaciones { id tipo montoCentavos categoria nota origen claveUnica fecha }
  lista { id productoId presentacion cantidad actualizadoEn eliminado }`;

export const MI_NEGOCIO = `query MiNegocio($desde: String) { miNegocio(desde: $desde) { ${CAMPOS} hasta } }`;
export const SINCRONIZAR_MI_NEGOCIO = `mutation SincronizarMiNegocio($cambios: CambiosDeNegocioEntrada!) { sincronizarMiNegocio(cambios: $cambios) { recibidos hasta } }`;

export const MI_TIPO_DE_NEGOCIO = `query MiTipoDeNegocio { miTipoDeNegocio { tipo subtipo elegidoEn } }`;
export const ELEGIR_TIPO_DE_NEGOCIO = `mutation ElegirTipoDeNegocio($tipo: String!, $subtipo: String) { elegirTipoDeNegocio(tipo: $tipo, subtipo: $subtipo) { tipo subtipo elegidoEn } }`;

export type RespuestaMiNegocio = { miNegocio: DatosDeNegocio & { hasta: string } };
export type RespuestaSincronizar = { sincronizarMiNegocio: { recibidos: number; hasta: string } };
export type RespuestaTipoDeNegocio = { miTipoDeNegocio: { tipo: string; subtipo: string | null; elegidoEn: string } | null };

/** Lo que baja del servidor, sin la marca: listo para guardar */
export function sinMarca({ hasta: _hasta, ...datos }: DatosDeNegocio & { hasta: string }): CambiosDeNegocio {
  return datos;
}
