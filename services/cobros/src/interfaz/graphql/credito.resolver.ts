import { Inject } from '@nestjs/common';
import { Args, Context, Mutation, Parent, Query, ResolveField, ResolveReference, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { AsignarCredito, type AsignarCreditoEntrada } from '../../aplicacion/asignar-credito.js';
import { AutorizarCredito, type AutorizarCreditoEntrada } from '../../aplicacion/autorizar-credito.js';
import { ConsultarCredito } from '../../aplicacion/consultar-credito.js';
import type { Dinero } from '../../dominio/dinero.js';
import { ErrorDeDominio } from '../../dominio/errores.js';
import type { LineaDeCredito } from '../../dominio/linea-de-credito.js';
import type { Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';

type Contexto = { req: { usuario: Usuario } };

const dinero = (d: Dinero) => ({ centavos: d.centavos, moneda: d.moneda, texto: d.texto() });

const vista = (l: LineaDeCredito) => ({
  id: l.id,
  tiendaId: l.tiendaId,
  mayoristaId: l.mayoristaId,
  limite: dinero(l.limite),
  usado: dinero(l.usado),
  disponible: dinero(l.disponible),
  plazoDias: l.plazoDias,
});

/** Traduce un error del dominio a un error de GraphQL con su código, para que la app muestre el motivo. */
const aGraphQL = (e: unknown): never => {
  if (e instanceof ErrorDeDominio) {
    throw new GraphQLError(e.message, { extensions: { code: e.codigo } });
  }
  throw e;
};

@Resolver('LineaDeCredito')
export class CreditoResolver {
  constructor(
    @Inject(ConsultarCredito) private readonly consultar: ConsultarCredito,
    @Inject(AutorizarCredito) private readonly autorizar: AutorizarCredito,
    @Inject(AsignarCredito) private readonly asignar: AsignarCredito,
  ) {}

  @Query('lineaDeCredito')
  async lineaDeCredito(@Args('tiendaId') tiendaId: string, @Args('mayoristaId') mayoristaId: string, @Context() ctx: Contexto) {
    try {
      const linea = await this.consultar.deLaSesion(tiendaId, mayoristaId, ctx.req.usuario.orgId);
      return linea ? vista(linea) : null;
    } catch (e) {
      return aGraphQL(e);
    }
  }

  @Query('misCreditosDados')
  async misCreditosDados(@Context() ctx: Contexto) {
    const orgId = ctx.req.usuario.orgId;
    if (!orgId) throw new GraphQLError('Tu cuenta no pertenece a una empresa', { extensions: { code: 'SIN_PERMISO' } });
    return (await this.consultar.delMayorista(orgId)).map(vista);
  }

  @Mutation('asignarCredito')
  async asignarCredito(@Args('entrada') entrada: AsignarCreditoEntrada, @Context() ctx: Contexto) {
    try {
      return vista(await this.asignar.ejecutar(entrada, ctx.req.usuario));
    } catch (e) {
      return aGraphQL(e);
    }
  }

  @Mutation('autorizarCredito')
  async autorizarCredito(@Args('entrada') entrada: AutorizarCreditoEntrada) {
    try {
      const r = await this.autorizar.ejecutar(entrada);
      return { ...r, autorizado: dinero(r.autorizado), disponible: dinero(r.disponible) };
    } catch (e) {
      return aGraphQL(e);
    }
  }

  @ResolveField('tienda')
  tienda(@Parent() linea: { tiendaId: string }) {
    return { __typename: 'Tienda', id: linea.tiendaId };
  }

  @ResolveReference()
  async resolverReferencia(ref: { id: string }) {
    const linea = await this.consultar.porId(ref.id);
    return linea ? vista(linea) : null;
  }
}
