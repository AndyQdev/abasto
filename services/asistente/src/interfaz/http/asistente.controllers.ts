import {
  BadRequestException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { DecidirPropuesta, EjecutarMision, MonitorearNegocio, type Mision } from '../../agentes/aplicacion/agentes.js';
import { AGENTES } from '../../agentes/dominio/agente.js';
import { MISIONES, REPOSITORIO_DE_PROPUESTAS, type RepositorioDePropuestas } from '../../agentes/puertos.js';
import { AuditoriaDynamoDB } from '../../infraestructura/dynamodb/auditoria.dynamodb.js';
import { generarExcel } from '../../infraestructura/excel/excel.js';
import { Publico, type Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';
import { crearServidorMcp } from '../../mcp/servidor-mcp.js';
import { ConsultaRechazada, ConsultarReportes } from '../../reportes/aplicacion/consultar-reportes.js';
import { ConsultarTableros } from '../../reportes/aplicacion/consultar-tableros.js';
import { ResponderPregunta } from '../../reportes/aplicacion/responder-pregunta.js';
import { FaltaPrecisar, ModeloNoDisponible, PreguntaNoEntendida, type Solicitante } from '../../reportes/puertos.js';

type ConUsuario = Request & { usuario: Usuario };
const solicitanteDe = (req: ConUsuario): Solicitante => ({ usuarioId: req.usuario.id, orgId: req.usuario.orgId });

const leer = <T>(esquema: z.ZodType<T>, valor: unknown): T => {
  const r = esquema.safeParse(valor);
  if (!r.success) throw new BadRequestException(z.prettifyError(r.error));
  return r.data;
};

@Controller('salud')
export class SaludController {
  @Publico()
  @Get()
  salud() {
    return { servicio: 'asistente', estado: 'ok', hora: new Date().toISOString() };
  }
}

/** Reportes generativos: la pregunta llega escrita o ya transcrita por Whisper en el navegador. */
@Controller('v1/reportes')
export class ReportesController {
  constructor(@Inject(ResponderPregunta) private readonly responder: ResponderPregunta) {}

  @Post('preguntas')
  @HttpCode(200)
  async preguntar(@Body() cuerpo: unknown, @Req() req: ConUsuario) {
    const { texto } = leer(z.object({ texto: z.string().min(3).max(500) }), cuerpo);
    try {
      return await this.responder.ejecutar(texto, solicitanteDe(req));
    } catch (e) {
      if (e instanceof ConsultaRechazada) throw new BadRequestException(`No pude armar ese reporte: ${e.motivo}`);
      if (e instanceof ModeloNoDisponible) {
        throw new ServiceUnavailableException('El Analista no respondió a tiempo. Vuelve a preguntar en un momento.');
      }
      if (e instanceof FaltaPrecisar) {
        throw new UnprocessableEntityException({ message: e.aclaracion, opciones: e.opciones, statusCode: 422 });
      }
      if (e instanceof PreguntaNoEntendida) {
        throw new UnprocessableEntityException(
          `No entendí la pregunta. Prueba con algo como: ${e.ejemplos.map((x) => `«${x}»`).join(', ')}`,
        );
      }
      throw e;
    }
  }

  @Post('excel')
  @HttpCode(200)
  async excel(@Body() cuerpo: unknown, @Res() res: Response) {
    const tabla = leer(
      z.object({
        titulo: z.string().max(80).default('Reporte'),
        columnas: z.array(z.string()).min(1),
        filas: z.array(z.record(z.string(), z.unknown())).max(1000),
      }),
      cuerpo,
    );
    const archivo = await generarExcel(tabla);
    res
      .setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('content-disposition', `attachment; filename="abasto-${Date.now()}.xlsx"`)
      .send(archivo);
  }
}

@Controller('v1/agentes')
export class AgentesController {
  constructor(
    @Inject(MISIONES) private readonly misiones: Mision[],
    @Inject(EjecutarMision) private readonly mision: EjecutarMision,
    @Inject(MonitorearNegocio) private readonly monitor: MonitorearNegocio,
    @Inject(DecidirPropuesta) private readonly decidir: DecidirPropuesta,
    @Inject(REPOSITORIO_DE_PROPUESTAS) private readonly propuestas: RepositorioDePropuestas,
  ) {}

  @Get()
  lista() {
    return Object.values(AGENTES);
  }

  @Get('propuestas')
  pendientes(@Req() req: ConUsuario) {
    return this.propuestas.pendientes(req.usuario.orgId);
  }

  /** «Monitorear mi negocio»: corren todas las misiones juntas. También lo puede llamar un horario de n8n. */
  @Post('monitorear')
  @HttpCode(200)
  monitorear(@Req() req: ConUsuario) {
    return this.monitor.monitorear(solicitanteDe(req));
  }

  @Post(':id/ejecutar')
  @HttpCode(200)
  async ejecutar(@Param('id') id: string, @Req() req: ConUsuario) {
    if (id === 'analista') throw new BadRequestException('El Analista no corre solo: hazle una pregunta en Reportes');
    const mision = this.misiones.find((m) => m.agenteId === id);
    if (!mision) throw new NotFoundException(`No existe el agente ${id}`);
    return this.mision.ejecutar(mision, solicitanteDe(req));
  }

  @Post('propuestas/:id/decision')
  @HttpCode(200)
  decision(@Param('id') id: string, @Body() cuerpo: unknown, @Req() req: ConUsuario) {
    const { aprobar } = leer(z.object({ aprobar: z.boolean() }), cuerpo);
    const sesion = req.headers.authorization?.replace(/^Bearer /, '');
    return this.decidir.ejecutar(req.usuario.orgId, id, aprobar, req.usuario.id, sesion);
  }
}

/** Tableros de Inteligencia: demanda prevista, stock en riesgo, segmentos, ventas y cobranza. */
@Controller('v1/tableros')
export class TablerosController {
  constructor(@Inject(ConsultarTableros) private readonly tableros: ConsultarTableros) {}

  @Get()
  ver(@Req() req: ConUsuario) {
    return this.tableros.ejecutar(solicitanteDe(req));
  }
}

/** MCP por HTTP (Streamable HTTP, sin sesión). Cualquier cliente MCP entra con un token de Keycloak. */
@Controller('mcp')
export class McpController {
  constructor(@Inject(ConsultarReportes) private readonly reportes: ConsultarReportes) {}

  @Post()
  async mcp(@Req() req: ConUsuario, @Res() res: Response) {
    const servidor = crearServidorMcp(this.reportes, solicitanteDe(req));
    const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transporte.close();
      void servidor.close();
    });
    await servidor.connect(transporte);
    await transporte.handleRequest(req, res, req.body);
  }
}

/** Para el Superadmin: las últimas consultas que se hicieron sobre los datos de una empresa. */
@Controller('v1/auditoria')
export class AuditoriaController {
  constructor(@Inject(AuditoriaDynamoDB) private readonly auditoria: AuditoriaDynamoDB) {}

  @Get()
  ultimas(@Query('orgId') orgId: string | undefined, @Req() req: ConUsuario) {
    if (!req.usuario.roles.includes('admin')) throw new ForbiddenException('Solo el equipo de Abasto ve la auditoría');
    if (!orgId) throw new BadRequestException('Falta orgId');
    return this.auditoria.ultimas(orgId);
  }
}
