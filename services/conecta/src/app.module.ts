import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CanalDeTiendas } from './aplicacion/canal-de-tiendas.js';
import { LlavesDeApi } from './aplicacion/llaves-de-api.js';
import { Notificaciones } from './aplicacion/notificaciones.js';
import { SincronizarLote } from './aplicacion/sincronizar-lote.js';
import { Webhooks } from './aplicacion/webhooks.js';
import {
  BITACORA,
  type Bitacora,
  CONSULTAS_DE_COMPRA,
  CUENTAS_DE_INTEGRACION,
  type CuentasDeIntegracion,
  DESTINO_DE_OPERACIONES,
  ENVIADOR_DE_NOTIFICACIONES,
  type EnviadorDeNotificaciones,
  REGISTRO_DE_AVISOS,
  type RegistroDeAvisos,
  REGISTRO_DE_DISPOSITIVOS,
  type RegistroDeDispositivos,
  REGISTRO_DE_PROMOCIONES,
  type RegistroDePromociones,
  ENTREGADOR_DE_WEBHOOKS,
  type EntregadorDeWebhooks,
  REGISTRO_DE_IDEMPOTENCIA,
  REGISTRO_DE_LLAVES,
  type RegistroDeLlaves,
  REGISTRO_DE_WEBHOOKS,
  type RegistroDeWebhooks,
  type DestinoDeOperaciones,
  type RegistroDeIdempotencia,
} from './dominio/puertos.js';
import { ConsultasGraphQL } from './infraestructura/destinos/consultas.graphql.js';
import { DestinoGraphQL } from './infraestructura/destinos/destino.graphql.js';
import { LlavesDynamoDB, WebhooksDynamoDB } from './infraestructura/dynamodb/integraciones.dynamodb.js';
import { CuentasKeycloak } from './infraestructura/keycloak/cuentas.keycloak.js';
import { EscuchaDeWebhooks } from './infraestructura/mensajeria/webhooks.rabbitmq.js';
import { EscuchaDeNotificaciones } from './infraestructura/mensajeria/notificaciones.rabbitmq.js';
import { AvisosDynamoDB, DispositivosDynamoDB, PromocionesDynamoDB } from './infraestructura/dynamodb/notificaciones.dynamodb.js';
import { crearEnviador } from './infraestructura/push/enviador.firebase.js';
import { DispositivosController, PromocionesController } from './interfaz/http/notificaciones.controller.js';
import { EntregadorHttp } from './infraestructura/webhooks/entregador.http.js';
import { crearClienteDynamoDB, DYNAMODB } from './infraestructura/dynamodb/cliente.js';
import { RegistroDynamoDB } from './infraestructura/dynamodb/registro.dynamodb.js';
import { BitacoraDynamoDB } from './infraestructura/dynamodb/bitacora.dynamodb.js';
import { EscuchaDeEventos } from './infraestructura/mensajeria/eventos.rabbitmq.js';
import { AutenticacionGuard } from './infraestructura/seguridad/autenticacion.guard.js';
import { AdminDeIntegracionesController, ComprasController, IntegracionesController, McpController } from './interfaz/http/integraciones.controller.js';
import { SaludController } from './interfaz/http/salud.controller.js';
import { SincronizacionController } from './interfaz/http/sincronizacion.controller.js';
import { ServidorDeTiempoReal } from './interfaz/ws/tiempo-real.servidor.js';

@Module({
  controllers: [
    SaludController,
    SincronizacionController,
    IntegracionesController,
    AdminDeIntegracionesController,
    ComprasController,
    McpController,
    DispositivosController,
    PromocionesController,
  ],
  providers: [
    { provide: DYNAMODB, useFactory: crearClienteDynamoDB },
    { provide: REGISTRO_DE_IDEMPOTENCIA, useClass: RegistroDynamoDB },
    { provide: DESTINO_DE_OPERACIONES, useClass: DestinoGraphQL },
    {
      provide: SincronizarLote,
      useFactory: (registro: RegistroDeIdempotencia, destino: DestinoDeOperaciones, bitacora: Bitacora) =>
        new SincronizarLote(registro, destino, bitacora),
      inject: [REGISTRO_DE_IDEMPOTENCIA, DESTINO_DE_OPERACIONES, BITACORA],
    },
    // CU-10: llaves de API, webhooks y lo que el e-commerce puede leer
    { provide: REGISTRO_DE_LLAVES, useClass: LlavesDynamoDB },
    { provide: CUENTAS_DE_INTEGRACION, useClass: CuentasKeycloak },
    {
      provide: LlavesDeApi,
      useFactory: (registro: RegistroDeLlaves, cuentas: CuentasDeIntegracion) => new LlavesDeApi(registro, cuentas),
      inject: [REGISTRO_DE_LLAVES, CUENTAS_DE_INTEGRACION],
    },
    { provide: REGISTRO_DE_WEBHOOKS, useClass: WebhooksDynamoDB },
    { provide: ENTREGADOR_DE_WEBHOOKS, useClass: EntregadorHttp },
    {
      provide: Webhooks,
      useFactory: (registro: RegistroDeWebhooks, entregador: EntregadorDeWebhooks) => new Webhooks(registro, entregador),
      inject: [REGISTRO_DE_WEBHOOKS, ENTREGADOR_DE_WEBHOOKS],
    },
    { provide: CONSULTAS_DE_COMPRA, useClass: ConsultasGraphQL },
    EscuchaDeWebhooks,
    // Bitácora (03/11): lo que entró para cada mayorista; la ve Panel › Conecta
    { provide: BITACORA, useClass: BitacoraDynamoDB },
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    // Tiempo real (02/11): RabbitMQ -> canal por tienda -> WebSocket /v1/tiempo-real
    { provide: CanalDeTiendas, useValue: new CanalDeTiendas() },
    EscuchaDeEventos,
    ServidorDeTiempoReal,
    // Notificaciones push (10/11): pedidos y promociones a la app, por Firebase (sin credenciales, modo prueba)
    { provide: REGISTRO_DE_DISPOSITIVOS, useClass: DispositivosDynamoDB },
    { provide: REGISTRO_DE_PROMOCIONES, useClass: PromocionesDynamoDB },
    { provide: REGISTRO_DE_AVISOS, useClass: AvisosDynamoDB },
    { provide: ENVIADOR_DE_NOTIFICACIONES, useFactory: () => crearEnviador() },
    {
      provide: Notificaciones,
      useFactory: (d: RegistroDeDispositivos, e: EnviadorDeNotificaciones, p: RegistroDePromociones, a: RegistroDeAvisos) => new Notificaciones(d, e, p, a),
      inject: [REGISTRO_DE_DISPOSITIVOS, ENVIADOR_DE_NOTIFICACIONES, REGISTRO_DE_PROMOCIONES, REGISTRO_DE_AVISOS],
    },
    EscuchaDeNotificaciones,
  ],
})
export class AppModule {}
