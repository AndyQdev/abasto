import { Inject } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ConsultarMiNegocio, SincronizarMiNegocio } from '../aplicacion/casos-de-uso.js';
import type { CambiosDeNegocio } from '../dominio/modelo.js';
import { CambioInvalido, SinNegocio } from '../dominio/reglas.js';
import type { Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';

type Contexto = { req: { usuario: Usuario } };

const aGraphQL = (e: unknown): never => {
  if (e instanceof CambioInvalido || e instanceof SinNegocio) throw new GraphQLError(e.message, { extensions: { code: e.codigo } });
  throw e;
};

/** GraphQL deja sin la clave lo opcional que no se mandó; el dominio espera null */
const nulos = <T extends object>(o: T, campos: string[]): T => {
  const r = { ...o } as Record<string, unknown>;
  for (const c of campos) if (r[c] === undefined) r[c] = null;
  return r as T;
};

export function normalizar(c: CambiosDeNegocio): CambiosDeNegocio {
  return {
    articulos: c.articulos?.map((a) => ({ ...nulos(a, ['detalle', 'rubro', 'productoId', 'proveedor', 'precioVentaCentavos', 'stockMinimo']), medida: nulos(a.medida, ['porEnvase']) })),
    movimientos: c.movimientos?.map((m) => nulos(m, ['costoUnitarioCentavos', 'nota', 'ventaId', 'tandaId'])),
    ventas: c.ventas?.map((v) => ({ ...nulos(v, ['clienteId']), lineas: v.lineas.map((l) => nulos(l, ['costoUnitarioCentavos'])) })),
    clientes: c.clientes?.map((k) => nulos(k, ['telefono'])),
    fiados: c.fiados?.map((f) => nulos(f, ['ventaId', 'nota'])),
    recetas: c.recetas,
    tandas: c.tandas,
    anotaciones: c.anotaciones?.map((a) => nulos(a, ['nota'])),
    lista: c.lista,
  };
}

/** «Mi negocio» del cliente con sesión. El org_id sale siempre del token, nunca de un argumento. */
@Resolver('MiNegocio')
export class MiNegocioResolver {
  constructor(
    @Inject(ConsultarMiNegocio) private readonly consultar: ConsultarMiNegocio,
    @Inject(SincronizarMiNegocio) private readonly sincronizar: SincronizarMiNegocio,
  ) {}

  @Query('miNegocio')
  async miNegocio(@Args('desde') desde: string | null, @Context() ctx: Contexto) {
    try {
      return await this.consultar.ejecutar(ctx.req.usuario.orgId, desde ?? null);
    } catch (e) {
      return aGraphQL(e);
    }
  }

  @Mutation('sincronizarMiNegocio')
  async sincronizarMiNegocio(@Args('cambios') cambios: CambiosDeNegocio, @Context() ctx: Contexto) {
    try {
      return await this.sincronizar.ejecutar(ctx.req.usuario.orgId, normalizar(cambios));
    } catch (e) {
      return aGraphQL(e);
    }
  }
}
