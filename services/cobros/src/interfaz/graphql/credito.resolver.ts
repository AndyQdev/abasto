import { Inject } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, ResolveReference, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { AutorizarCredito, type AutorizarCreditoEntrada } from '../../aplicacion/autorizar-credito.js';
import { ConsultarCredito } from '../../aplicacion/consultar-credito.js';
import type { Dinero } from '../../dominio/dinero.js';
import { ErrorDeDominio } from '../../dominio/errores.js';
import type { LineaDeCredito } from '../../dominio/linea-de-credito.js';

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
  ) {}

  @Query('lineaDeCredito')
  async lineaDeCredito(@Args('tiendaId') tiendaId: string, @Args('mayoristaId') mayoristaId: string) {
    const linea = await this.consultar.porTiendaYMayorista(tiendaId, mayoristaId);
    return linea ? vista(linea) : null;
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
