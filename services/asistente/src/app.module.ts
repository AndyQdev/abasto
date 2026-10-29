import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type pg from 'pg';
import { DecidirPropuesta, EjecutarCobranza } from './agentes/aplicacion/agentes.js';
import {
  EJECUTOR_DE_ACCIONES,
  REPOSITORIO_DE_PROPUESTAS,
  type EjecutorDeAcciones,
  type RepositorioDePropuestas,
} from './agentes/puertos.js';
import { EjecutorN8n } from './infraestructura/acciones/ejecutor.n8n.js';
import { AuditoriaDynamoDB } from './infraestructura/dynamodb/auditoria.dynamodb.js';
import { crearClienteDynamoDB, DYNAMODB } from './infraestructura/dynamodb/cliente.js';
import { PropuestasDynamoDB } from './infraestructura/dynamodb/propuestas.dynamodb.js';
import { ModeloAnthropic } from './infraestructura/modelos/modelo.anthropic.js';
import { ModeloSimulado } from './infraestructura/modelos/modelo.simulado.js';
import { crearPoolDueno, crearPoolLector, POOL_DUENO, POOL_LECTOR } from './infraestructura/postgres/conexiones.js';
import { ConsultorPostgres } from './infraestructura/postgres/consultor.pg.js';
import { migrar } from './infraestructura/postgres/migrador.js';
import { AutenticacionGuard } from './infraestructura/seguridad/autenticacion.guard.js';
import {
  AgentesController,
  AuditoriaController,
  McpController,
  ReportesController,
  SaludController,
} from './interfaz/http/asistente.controllers.js';
import { DirectorioCatalogo } from './infraestructura/catalogo/directorio.catalogo.js';
import { ProyectorServicio } from './proyector/proyector.servicio.js';
import { DIRECTORIO_DE_TIENDAS } from './proyector/puertos.js';
import { ConsultarReportes } from './reportes/aplicacion/consultar-reportes.js';
import { ResponderPregunta } from './reportes/aplicacion/responder-pregunta.js';
import {
  AUDITORIA_DE_CONSULTAS,
  CONSULTOR_DE_REPORTES,
  MODELO_DE_LENGUAJE,
  type AuditoriaDeConsultas,
  type ConsultorDeReportes,
  type ModeloDeLenguaje,
} from './reportes/puertos.js';

/** Sin llave de API se usa el modelo simulado: la demo y las pruebas funcionan igual. */
const elegirModelo = (): ModeloDeLenguaje =>
  process.env.ANTHROPIC_API_KEY ? new ModeloAnthropic() : new ModeloSimulado();

@Module({
  controllers: [SaludController, ReportesController, AgentesController, McpController, AuditoriaController],
  providers: [
    { provide: DYNAMODB, useFactory: crearClienteDynamoDB },
    { provide: POOL_DUENO, useFactory: crearPoolDueno },
    { provide: POOL_LECTOR, useFactory: crearPoolLector },
    { provide: MODELO_DE_LENGUAJE, useFactory: elegirModelo },
    { provide: CONSULTOR_DE_REPORTES, useClass: ConsultorPostgres },
    AuditoriaDynamoDB,
    { provide: AUDITORIA_DE_CONSULTAS, useExisting: AuditoriaDynamoDB },
    { provide: REPOSITORIO_DE_PROPUESTAS, useClass: PropuestasDynamoDB },
    { provide: EJECUTOR_DE_ACCIONES, useClass: EjecutorN8n },
    {
      provide: ConsultarReportes,
      useFactory: (c: ConsultorDeReportes, a: AuditoriaDeConsultas) => new ConsultarReportes(c, a),
      inject: [CONSULTOR_DE_REPORTES, AUDITORIA_DE_CONSULTAS],
    },
    {
      provide: ResponderPregunta,
      useFactory: (m: ModeloDeLenguaje, r: ConsultarReportes) => new ResponderPregunta(m, r),
      inject: [MODELO_DE_LENGUAJE, ConsultarReportes],
    },
    {
      provide: EjecutarCobranza,
      useFactory: (r: ConsultarReportes, p: RepositorioDePropuestas) => new EjecutarCobranza(r, p),
      inject: [ConsultarReportes, REPOSITORIO_DE_PROPUESTAS],
    },
    {
      provide: DecidirPropuesta,
      useFactory: (p: RepositorioDePropuestas, e: EjecutorDeAcciones) => new DecidirPropuesta(p, e),
      inject: [REPOSITORIO_DE_PROPUESTAS, EJECUTOR_DE_ACCIONES],
    },
    { provide: DIRECTORIO_DE_TIENDAS, useFactory: () => new DirectorioCatalogo() },
    ProyectorServicio,
    { provide: APP_GUARD, useClass: AutenticacionGuard },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly log = new Logger('Asistente');

  constructor(
    @Inject(POOL_DUENO) private readonly dueno: pg.Pool,
    @Inject(MODELO_DE_LENGUAJE) private readonly modelo: ModeloDeLenguaje,
  ) {}

  async onModuleInit() {
    const aplicadas = await migrar(this.dueno);
    if (aplicadas.length) this.log.log(`Migraciones aplicadas en reportes: ${aplicadas.join(', ')}`);
    this.log.log(`Modelo de lenguaje: ${this.modelo.nombre}`);
  }
}
