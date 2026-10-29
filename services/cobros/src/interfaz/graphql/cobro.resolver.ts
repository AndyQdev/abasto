import { Inject } from '@nestjs/common';
import { Args, Context, Mutation, Parent, Query, ResolveField, ResolveReference, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ConsultarCobro, PagarQr } from '../../aplicacion/cobros-qr.js';
import type { CobroQr } from '../../dominio/cobro-qr.js';
import { ErrorDeDominio } from '../../dominio/errores.js';
import type { Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';

type Contexto = { req: { usuario: Usuario } };

const vista = (c: CobroQr) => ({
  pedidoId: c.pedidoId,
  monto: { centavos: c.monto.centavos, moneda: c.monto.moneda, texto: c.monto.texto() },
  estado: c.estado,
  codigo: c.codigo,
  venceEn: c.venceEn.toISOString(),
  pagadoEn: c.pagadoEn?.toISOString() ?? null,
});

const aGraphQL = (e: unknown): never => {
  if (e instanceof ErrorDeDominio) throw new GraphQLError(e.message, { extensions: { code: e.codigo } });
  throw e;
};

@Resolver('CobroQr')
export class CobroResolver {
  constructor(
    @Inject(ConsultarCobro) private readonly consultar: ConsultarCobro,
    @Inject(PagarQr) private readonly pagar: PagarQr,
  ) {}

  @Query('cobroDePedido')
  async cobroDePedido(@Args('pedidoId') pedidoId: string, @Context() ctx: Contexto) {
    const cobro = await this.consultar.dePedido(pedidoId, ctx.req.usuario.orgId);
    return cobro ? vista(cobro) : null;
  }

  @Mutation('pagarQrDePrueba')
  async pagarQrDePrueba(@Args('pedidoId') pedidoId: string, @Context() ctx: Contexto) {
    if (process.env.QR_DE_PRUEBA !== 'si') {
      throw new GraphQLError('El pago de prueba está apagado en este entorno', { extensions: { code: 'SIN_PERMISO' } });
    }
    try {
      return vista(await this.pagar.ejecutar(pedidoId, ctx.req.usuario.orgId));
    } catch (e) {
      return aGraphQL(e);
    }
  }
}

/** Cobros le agrega a Pedido (de Pedidos) su cobro por QR: el Router junta los dos en una consulta. */
@Resolver('Pedido')
export class PedidoConCobroResolver {
  constructor(@Inject(ConsultarCobro) private readonly consultar: ConsultarCobro) {}

  @ResolveReference()
  resolverReferencia(ref: { id: string }) {
    return { id: ref.id };
  }

  @ResolveField('cobro')
  async cobro(@Parent() pedido: { id: string }, @Context() ctx: Contexto) {
    const cobro = await this.consultar.dePedido(pedido.id, ctx.req.usuario.orgId);
    return cobro ? vista(cobro) : null;
  }
}
