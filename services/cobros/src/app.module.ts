import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { AtenderComando } from './aplicacion/atender-comando.js';
import { AutorizarCredito, LiberarCredito } from './aplicacion/autorizar-credito.js';
import { ConsultarCobro, DevolverQr, GenerarQr, PagarQr, VencerQrs, type Reloj } from './aplicacion/cobros-qr.js';
import { ConsultarCredito } from './aplicacion/consultar-credito.js';
import {
  COBRO_QR_REPOSITORIO,
  MENSAJES_PROCESADOS,
  OUTBOX,
  type CobroQrRepositorio,
  type MensajesProcesados,
  type Outbox,
} from './dominio/cobro-qr.repositorio.js';
import {
  LINEA_DE_CREDITO_REPOSITORIO,
  type LineaDeCreditoRepositorio,
} from './dominio/linea-de-credito.repositorio.js';
import { ConsumidorDeComandos, PublicadorOutbox, RevisorDeQrs } from './infraestructura/mensajeria/rabbitmq.js';
import { CobroQrPrisma, MensajesProcesadosPrisma, OutboxPrisma } from './infraestructura/persistencia/cobro-qr.prisma.js';
import { LineaDeCreditoPrisma } from './infraestructura/persistencia/linea-de-credito.prisma.js';
import { PersistenciaModule } from './infraestructura/persistencia/persistencia.module.js';
import { AutenticacionGuard } from './infraestructura/seguridad/autenticacion.guard.js';
import { CobroResolver, PedidoConCobroResolver } from './interfaz/graphql/cobro.resolver.js';
import { CreditoResolver } from './interfaz/graphql/credito.resolver.js';
import { SaludController } from './interfaz/http/salud.controller.js';
import { MiNegocioModule } from './mi-negocio/mi-negocio.module.js';

/** Los casos de uso no conocen Nest: se arman aquí con su repositorio. */
const casoDeUso = <T>(Clase: new (repo: LineaDeCreditoRepositorio) => T) => ({
  provide: Clase,
  useFactory: (repo: LineaDeCreditoRepositorio) => new Clase(repo),
  inject: [LINEA_DE_CREDITO_REPOSITORIO],
});

const RELOJ = Symbol('Reloj');
const reloj: Reloj = { ahora: () => new Date() };
/** Minutos que tiene la tienda para pagar el QR antes de que la saga libere el stock. */
const vigenciaMinutos = Number(process.env.QR_VIGENCIA_MINUTOS ?? 30);

@Module({
  imports: [
    PersistenciaModule,
    MiNegocioModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typePaths: [join(process.cwd(), 'schema.graphql')],
      context: ({ req }: { req: unknown }) => ({ req }),
      // Sin esto, Nest no corre el guard en los campos resueltos por federación y no hay sesión
      fieldResolverEnhancers: ['guards'],
      includeStacktraceInErrorResponses: process.env.NODE_ENV !== 'production',
    }),
  ],
  controllers: [SaludController],
  providers: [
    { provide: LINEA_DE_CREDITO_REPOSITORIO, useClass: LineaDeCreditoPrisma },
    { provide: COBRO_QR_REPOSITORIO, useClass: CobroQrPrisma },
    { provide: OUTBOX, useClass: OutboxPrisma },
    { provide: MENSAJES_PROCESADOS, useClass: MensajesProcesadosPrisma },
    { provide: RELOJ, useValue: reloj },
    casoDeUso(AutorizarCredito),
    casoDeUso(LiberarCredito),
    casoDeUso(ConsultarCredito),
    {
      provide: GenerarQr,
      useFactory: (cobros: CobroQrRepositorio) => new GenerarQr(cobros, { vigenciaMinutos, generarId: randomUUID, reloj }),
      inject: [COBRO_QR_REPOSITORIO],
    },
    { provide: PagarQr, useFactory: (c: CobroQrRepositorio, r: Reloj) => new PagarQr(c, r), inject: [COBRO_QR_REPOSITORIO, RELOJ] },
    { provide: VencerQrs, useFactory: (c: CobroQrRepositorio, r: Reloj) => new VencerQrs(c, r), inject: [COBRO_QR_REPOSITORIO, RELOJ] },
    { provide: DevolverQr, useFactory: (c: CobroQrRepositorio) => new DevolverQr(c), inject: [COBRO_QR_REPOSITORIO] },
    { provide: ConsultarCobro, useFactory: (c: CobroQrRepositorio) => new ConsultarCobro(c), inject: [COBRO_QR_REPOSITORIO] },
    {
      provide: AtenderComando,
      useFactory: (
        autorizarCredito: AutorizarCredito,
        liberarCredito: LiberarCredito,
        generarQr: GenerarQr,
        devolverQr: DevolverQr,
        outbox: Outbox,
        procesados: MensajesProcesados,
      ) => new AtenderComando({ autorizarCredito, liberarCredito, generarQr, devolverQr }, outbox, procesados),
      inject: [AutorizarCredito, LiberarCredito, GenerarQr, DevolverQr, OUTBOX, MENSAJES_PROCESADOS],
    },
    ConsumidorDeComandos,
    PublicadorOutbox,
    RevisorDeQrs,
    CreditoResolver,
    CobroResolver,
    PedidoConCobroResolver,
    { provide: APP_GUARD, useClass: AutenticacionGuard },
  ],
})
export class AppModule {}
