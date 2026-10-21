import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SincronizarLote } from './aplicacion/sincronizar-lote.js';
import {
  DESTINO_DE_OPERACIONES,
  REGISTRO_DE_IDEMPOTENCIA,
  type DestinoDeOperaciones,
  type RegistroDeIdempotencia,
} from './dominio/puertos.js';
import { DestinoGraphQL } from './infraestructura/destinos/destino.graphql.js';
import { crearClienteDynamoDB, DYNAMODB } from './infraestructura/dynamodb/cliente.js';
import { RegistroDynamoDB } from './infraestructura/dynamodb/registro.dynamodb.js';
import { AutenticacionGuard } from './infraestructura/seguridad/autenticacion.guard.js';
import { SaludController } from './interfaz/http/salud.controller.js';
import { SincronizacionController } from './interfaz/http/sincronizacion.controller.js';

@Module({
  controllers: [SaludController, SincronizacionController],
  providers: [
    { provide: DYNAMODB, useFactory: crearClienteDynamoDB },
    { provide: REGISTRO_DE_IDEMPOTENCIA, useClass: RegistroDynamoDB },
    { provide: DESTINO_DE_OPERACIONES, useClass: DestinoGraphQL },
    {
      provide: SincronizarLote,
      useFactory: (registro: RegistroDeIdempotencia, destino: DestinoDeOperaciones) =>
        new SincronizarLote(registro, destino),
      inject: [REGISTRO_DE_IDEMPOTENCIA, DESTINO_DE_OPERACIONES],
    },
    { provide: APP_GUARD, useClass: AutenticacionGuard },
  ],
})
export class AppModule {}
