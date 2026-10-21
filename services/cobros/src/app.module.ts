import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';
import { AutorizarCredito, LiberarCredito } from './aplicacion/autorizar-credito.js';
import { ConsultarCredito } from './aplicacion/consultar-credito.js';
import {
  LINEA_DE_CREDITO_REPOSITORIO,
  type LineaDeCreditoRepositorio,
} from './dominio/linea-de-credito.repositorio.js';
import { LineaDeCreditoPrisma } from './infraestructura/persistencia/linea-de-credito.prisma.js';
import { PrismaServicio } from './infraestructura/persistencia/prisma.servicio.js';
import { AutenticacionGuard } from './infraestructura/seguridad/autenticacion.guard.js';
import { CreditoResolver } from './interfaz/graphql/credito.resolver.js';
import { SaludController } from './interfaz/http/salud.controller.js';

/** Los casos de uso no conocen Nest: se arman aquí con su repositorio. */
const casoDeUso = <T>(Clase: new (repo: LineaDeCreditoRepositorio) => T) => ({
  provide: Clase,
  useFactory: (repo: LineaDeCreditoRepositorio) => new Clase(repo),
  inject: [LINEA_DE_CREDITO_REPOSITORIO],
});

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typePaths: [join(process.cwd(), 'schema.graphql')],
      context: ({ req }: { req: unknown }) => ({ req }),
      includeStacktraceInErrorResponses: process.env.NODE_ENV !== 'production',
    }),
  ],
  controllers: [SaludController],
  providers: [
    PrismaServicio,
    { provide: LINEA_DE_CREDITO_REPOSITORIO, useClass: LineaDeCreditoPrisma },
    casoDeUso(AutorizarCredito),
    casoDeUso(LiberarCredito),
    casoDeUso(ConsultarCredito),
    CreditoResolver,
    { provide: APP_GUARD, useClass: AutenticacionGuard },
  ],
})
export class AppModule {}
