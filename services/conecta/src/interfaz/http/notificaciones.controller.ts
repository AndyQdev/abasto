import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, Param, Post, Put, Req } from '@nestjs/common';
import { Notificaciones, type Quien } from '../../aplicacion/notificaciones.js';
import { ErrorDeIntegracion } from '../../dominio/llave-de-api.js';
import type { EntradaDePromocion } from '../../dominio/notificacion.js';
import type { Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';

type Peticion = { headers: Record<string, string | undefined>; usuario?: Usuario };

/** Solo una persona con su sesión: una llave de API (CU-10) no recibe notificaciones ni manda promociones. */
function persona(p: Peticion): Quien {
  const u = p.usuario;
  if (!u || u.porLlave) throw new ForbiddenException('Las notificaciones son para la app de Abasto');
  return { id: u.id, orgId: u.orgId };
}

function admin(p: Peticion): Quien {
  if (!p.usuario?.roles.includes('admin')) throw new ForbiddenException('Solo el equipo de Abasto manda promociones');
  return persona(p);
}

async function respondiendo<T>(hacer: () => Promise<T>): Promise<T> {
  try {
    return await hacer();
  } catch (e) {
    if (e instanceof ErrorDeIntegracion) throw new BadRequestException({ codigo: e.codigo, message: e.message });
    throw e;
  }
}

const CLAVE = /^[0-9a-f-]{36}$/i;

/** Notificaciones push: el teléfono se registra al entrar y se borra al salir. Contrato: contracts/openapi/conecta.yaml. */
@Controller('v1/dispositivos')
export class DispositivosController {
  constructor(@Inject(Notificaciones) private readonly notificaciones: Notificaciones) {}

  @Put()
  async registrar(@Req() p: Peticion, @Body() cuerpo: { token?: unknown; plataforma?: unknown }) {
    const d = await respondiendo(() => this.notificaciones.registrar(persona(p), cuerpo ?? {}));
    return { registrado: true, plataforma: d.plataforma };
  }

  @Delete(':token')
  @HttpCode(204)
  async quitar(@Req() p: Peticion, @Param('token') token: string) {
    await this.notificaciones.quitar(persona(p), token);
  }

  /** «Probar notificación» de la app: le manda una a los teléfonos de quien la pide. */
  @Post('prueba')
  @HttpCode(200)
  probar(@Req() p: Peticion) {
    return this.notificaciones.probar(persona(p));
  }
}

/** Superadmin › Promociones. */
@Controller('v1/admin')
export class PromocionesController {
  constructor(@Inject(Notificaciones) private readonly notificaciones: Notificaciones) {}

  @Get('promociones')
  promociones(@Req() p: Peticion) {
    admin(p);
    return this.notificaciones.ultimasPromociones();
  }

  /** Manda la promoción a todos los teléfonos. Con Idempotency-Key: repetirla devuelve la misma y no vuelve a sonar. */
  @Post('promociones')
  @HttpCode(200)
  async crear(@Req() p: Peticion, @Body() cuerpo: EntradaDePromocion) {
    const quien = admin(p);
    const clave = p.headers['idempotency-key'] ?? '';
    if (!CLAVE.test(clave)) throw new BadRequestException({ codigo: 'FALTA_CLAVE', message: 'Falta el Idempotency-Key (un UUID por promoción)' });
    return respondiendo(() => this.notificaciones.crearPromocion(quien, clave, cuerpo ?? { titulo: '', mensaje: '' }));
  }

  @Get('notificaciones')
  resumen(@Req() p: Peticion) {
    admin(p);
    return this.notificaciones.resumen();
  }
}
