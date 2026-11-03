import { Module } from '@nestjs/common';
import { ConsultarMiNegocio, RegistrarCompraEntregada, SincronizarMiNegocio } from './aplicacion/casos-de-uso.js';
import { DIRECTORIO_DE_PRODUCTOS, REPOSITORIO_DE_NEGOCIO, type DirectorioDeProductos, type Reloj, type RepositorioDeNegocio } from './dominio/puertos.js';
import { DirectorioCatalogo } from './infraestructura/directorio.catalogo.js';
import { ConsumidorDeEntregas } from './infraestructura/entregas.rabbitmq.js';
import { NegocioPrisma } from './infraestructura/negocio.prisma.js';
import { MiNegocioResolver } from './interfaz/mi-negocio.resolver.js';

const RELOJ = Symbol('RelojDeNegocio');

/**
 * «Mi negocio» del cliente (docs/plan-mi-negocio.md). Vive dentro de Cobros pero aparte: su esquema `negocio` en
 * Postgres, sus capas y su cola (cobros.mi-negocio). Para sacarlo a un servicio propio alcanza con mover esta carpeta.
 */
@Module({
  providers: [
    { provide: RELOJ, useValue: { ahora: () => new Date() } satisfies Reloj },
    { provide: REPOSITORIO_DE_NEGOCIO, useClass: NegocioPrisma },
    { provide: DIRECTORIO_DE_PRODUCTOS, useFactory: () => new DirectorioCatalogo() },
    { provide: SincronizarMiNegocio, useFactory: (r: RepositorioDeNegocio, t: Reloj) => new SincronizarMiNegocio(r, t), inject: [REPOSITORIO_DE_NEGOCIO, RELOJ] },
    { provide: ConsultarMiNegocio, useFactory: (r: RepositorioDeNegocio, t: Reloj) => new ConsultarMiNegocio(r, t), inject: [REPOSITORIO_DE_NEGOCIO, RELOJ] },
    {
      provide: RegistrarCompraEntregada,
      useFactory: (r: RepositorioDeNegocio, d: DirectorioDeProductos, t: Reloj) => new RegistrarCompraEntregada(r, d, t),
      inject: [REPOSITORIO_DE_NEGOCIO, DIRECTORIO_DE_PRODUCTOS, RELOJ],
    },
    MiNegocioResolver,
    ConsumidorDeEntregas,
  ],
})
export class MiNegocioModule {}
