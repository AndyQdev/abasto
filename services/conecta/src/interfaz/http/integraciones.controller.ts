import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Response } from 'express';
import { LlavesDeApi } from '../../aplicacion/llaves-de-api.js';
import { SincronizarLote } from '../../aplicacion/sincronizar-lote.js';
import { entregaVisible, Webhooks } from '../../aplicacion/webhooks.js';
import { ErrorDeIntegracion } from '../../dominio/llave-de-api.js';
import { CONSULTAS_DE_COMPRA, type ConsultasDeCompra } from '../../dominio/puertos.js';
import type { Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';
import { crearServidorMcp } from '../mcp/servidor-mcp.js';

type Peticion = { headers: Record<string, string | undefined>; usuario?: Usuario; token?: string; body?: unknown };

const tokenDe = (p: Peticion) => p.token ?? (p.headers.authorization ?? '').replace(/^Bearer /, '');

function tiendaDe(p: Peticion): string {
  const usuario = p.usuario;
  if (!usuario?.orgId || !usuario.roles.includes('tienda')) throw new ForbiddenException('Esto es para las tiendas que compran en Abasto');
  return usuario.orgId;
}

/** Las llaves se manejan con la sesión de la persona: una llave filtrada no puede sacar otras ni ocultarse. */
function tiendaConSesion(p: Peticion): string {
  if (p.usuario?.porLlave) throw new ForbiddenException('Las llaves se manejan desde la app de Abasto');
  return tiendaDe(p);
}

const soloAdmin = (p: Peticion) => {
  if (!p.usuario?.roles.includes('admin')) throw new ForbiddenException('Solo el equipo de Abasto ve esto');
};

/** Traduce los errores de la integración a su código HTTP, con el motivo para la persona. */
async function respondiendo<T>(hacer: () => Promise<T>): Promise<T> {
  try {
    return await hacer();
  } catch (e) {
    if (!(e instanceof ErrorDeIntegracion)) throw e;
    const cuerpo = { codigo: e.codigo, message: e.message };
    if (e.codigo.endsWith('NO_EXISTE')) throw new NotFoundException(cuerpo);
    if (e.codigo.startsWith('DEMASIAD') || e.codigo === 'ENTREGA_YA_LLEGO') throw new ConflictException(cuerpo);
    throw new BadRequestException(cuerpo);
  }
}

const textoOpcional = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : undefined);

/** CU-10: llaves de API y webhooks de la tienda (se manejan en App › Cuenta › Conectar mi tienda en línea). */
@Controller('v1')
export class IntegracionesController {
  constructor(
    @Inject(LlavesDeApi) private readonly llaves: LlavesDeApi,
    @Inject(Webhooks) private readonly webhooks: Webhooks,
  ) {}

  @Get('llaves')
  verLlaves(@Req() p: Peticion) {
    return this.llaves.delaOrganizacion(tiendaConSesion(p));
  }

  @Post('llaves')
  crearLlave(@Req() p: Peticion, @Body() cuerpo: { nombre?: unknown }) {
    const tienda = tiendaConSesion(p);
    return respondiendo(() => this.llaves.crear(tienda, cuerpo?.nombre));
  }

  @Delete('llaves/:id')
  @HttpCode(204)
  async revocarLlave(@Req() p: Peticion, @Param('id') id: string) {
    const tienda = tiendaConSesion(p);
    await respondiendo(() => this.llaves.revocar(tienda, id));
  }

  @Get('webhooks')
  verWebhooks(@Req() p: Peticion) {
    return this.webhooks.delaOrganizacion(tiendaDe(p));
  }

  @Post('webhooks')
  crearWebhook(@Req() p: Peticion, @Body() cuerpo: { url?: unknown }) {
    const tienda = tiendaDe(p);
    return respondiendo(() => this.webhooks.registrar(tienda, cuerpo?.url));
  }

  @Delete('webhooks/:id')
  @HttpCode(204)
  async borrarWebhook(@Req() p: Peticion, @Param('id') id: string) {
    const tienda = tiendaDe(p);
    await respondiendo(() => this.webhooks.borrar(tienda, id));
  }

  @Post('webhooks/:id/probar')
  @HttpCode(200)
  async probarWebhook(@Req() p: Peticion, @Param('id') id: string) {
    const tienda = tiendaDe(p);
    return entregaVisible(await respondiendo(() => this.webhooks.probar(tienda, id)));
  }

  @Get('entregas')
  async verEntregas(@Req() p: Peticion) {
    return (await this.webhooks.entregasDe(tiendaDe(p))).map(entregaVisible);
  }

  @Post('entregas/:id/reenviar')
  @HttpCode(200)
  async reenviarEntrega(@Req() p: Peticion, @Param('id') id: string) {
    const tienda = tiendaDe(p);
    return entregaVisible(await respondiendo(() => this.webhooks.reenviar(id, tienda)));
  }
}

/** Superadmin › Integraciones: todas las llaves y webhooks, y los avisos que fallaron. */
@Controller('v1/admin')
export class AdminDeIntegracionesController {
  constructor(
    @Inject(LlavesDeApi) private readonly llaves: LlavesDeApi,
    @Inject(Webhooks) private readonly webhooks: Webhooks,
  ) {}

  @Get('integraciones')
  async integraciones(@Req() p: Peticion) {
    soloAdmin(p);
    const [llaves, webhooks, entregas] = await Promise.all([this.llaves.todas(), this.webhooks.todos(), this.webhooks.ultimasEntregas()]);
    return { llaves, webhooks, entregas: entregas.map(entregaVisible) };
  }

  @Post('entregas/:id/reenviar')
  @HttpCode(200)
  async reenviar(@Req() p: Peticion, @Param('id') id: string) {
    soloAdmin(p);
    return entregaVisible(await respondiendo(() => this.webhooks.reenviar(id, null)));
  }
}

/** CU-10: lo que el e-commerce lee para comprar. Con precios de esa tienda, porque va con su token. */
@Controller('v1')
export class ComprasController {
  constructor(@Inject(CONSULTAS_DE_COMPRA) private readonly consultas: ConsultasDeCompra) {}

  @Get('mayoristas')
  mayoristas(@Req() p: Peticion, @Query('busqueda') busqueda?: string) {
    return this.consultas.mayoristas(tokenDe(p), textoOpcional(busqueda));
  }

  @Get('productos')
  productos(@Req() p: Peticion, @Query('busqueda') busqueda?: string, @Query('mayoristaId') mayoristaId?: string) {
    return this.consultas.productos(tokenDe(p), { busqueda: textoOpcional(busqueda), mayoristaId: textoOpcional(mayoristaId) });
  }

  @Get('pedidos')
  misPedidos(@Req() p: Peticion) {
    return this.consultas.misCompras(tokenDe(p));
  }

  @Get('pedidos/:id')
  async pedido(@Req() p: Peticion, @Param('id') id: string) {
    const pedido = await this.consultas.pedido(tokenDe(p), id);
    if (!pedido) throw new NotFoundException('Ese pedido no existe o no es de esta tienda');
    return pedido;
  }
}

/** MCP por HTTP (Streamable HTTP, sin sesión). Entra con una llave de API o un token de Keycloak de una tienda. */
@Controller('mcp')
export class McpController {
  constructor(
    @Inject(CONSULTAS_DE_COMPRA) private readonly consultas: ConsultasDeCompra,
    @Inject(SincronizarLote) private readonly sincronizar: SincronizarLote,
  ) {}

  @Post()
  async mcp(@Req() p: Peticion, @Res() res: Response) {
    const servidor = crearServidorMcp(this.consultas, this.sincronizar, { token: tokenDe(p), tiendaId: tiendaDe(p) });
    const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transporte.close();
      void servidor.close();
    });
    await servidor.connect(transporte);
    await transporte.handleRequest(p as never, res as never, p.body);
  }
}
