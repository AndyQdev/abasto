import { Inject } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ConsultarCuentas, RegistrarPago, type RegistrarPagoEntrada } from '../../aplicacion/cuentas-por-cobrar.js';
import type { CuentaPorCobrar } from '../../dominio/cuenta-por-cobrar.js';
import type { Dinero } from '../../dominio/dinero.js';
import { ErrorDeDominio } from '../../dominio/errores.js';
import type { Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';

type Contexto = { req: { usuario: Usuario } };

const dinero = (d: Dinero) => ({ centavos: d.centavos, moneda: d.moneda, texto: d.texto() });

const vista = (c: CuentaPorCobrar, hoy: Date) => ({
  id: c.id,
  pedidoId: c.pedidoId,
  codigo: c.codigo,
  // La tienda es de Catálogo: el router completa el nombre y la ciudad
  tienda: { __typename: 'Tienda', id: c.tiendaId },
  origen: c.origen,
  monto: dinero(c.monto),
  pagado: dinero(c.pagado),
  saldo: dinero(c.saldo),
  estado: c.estado,
  abiertaEn: c.abiertaEn.toISOString(),
  venceEn: c.venceEn?.toISOString() ?? null,
  diasDeAtraso: c.diasDeAtraso(hoy),
  pagos: c.listaDePagos().map((p) => ({
    id: p.id,
    monto: dinero(p.monto),
    forma: p.forma,
    nota: p.nota ?? null,
    registradoEn: p.registradoEn.toISOString(),
  })),
});

/** CU-09 · Cuentas por cobrar. Todo sale del mayorista del token, nunca de un argumento. */
@Resolver('CuentaPorCobrar')
export class CuentasResolver {
  constructor(
    @Inject(ConsultarCuentas) private readonly consultar: ConsultarCuentas,
    @Inject(RegistrarPago) private readonly registrar: RegistrarPago,
  ) {}

  @Query('cuentasPorCobrar')
  async cuentasPorCobrar(@Args('conPagadas') conPagadas: boolean | null, @Context() ctx: Contexto) {
    const orgId = ctx.req.usuario.orgId;
    if (!orgId) throw new GraphQLError('Tu cuenta no pertenece a una empresa', { extensions: { code: 'SIN_PERMISO' } });
    const hoy = new Date();
    const r = await this.consultar.delMayorista(orgId, Boolean(conPagadas), hoy);
    return {
      porCobrar: dinero(r.porCobrar),
      vencido: dinero(r.vencido),
      tiendas: r.tiendas,
      cuentas: r.cuentas.map((c) => vista(c, hoy)),
    };
  }

  @Mutation('registrarPago')
  async registrarPago(@Args('entrada') entrada: RegistrarPagoEntrada, @Context() ctx: Contexto) {
    try {
      const cuenta = await this.registrar.ejecutar(entrada, { usuarioId: ctx.req.usuario.id, orgId: ctx.req.usuario.orgId });
      return vista(cuenta, new Date());
    } catch (e) {
      if (e instanceof ErrorDeDominio) throw new GraphQLError(e.message, { extensions: { code: e.codigo } });
      // Dos cobros a la vez que juntos pasan lo que se debe: lo frena el CHECK de la base
      if (String((e as Error).message).includes('cuentas_por_cobrar_montos_check')) {
        throw new GraphQLError('Otro pago de esta cuenta se registró recién. Vuelve a abrirla y revisa el saldo.', {
          extensions: { code: 'PAGO_MAYOR_QUE_EL_SALDO' },
        });
      }
      throw e;
    }
  }
}
