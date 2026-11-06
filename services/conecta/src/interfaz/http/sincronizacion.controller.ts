import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { SincronizarLote } from '../../aplicacion/sincronizar-lote.js';
import { origenDe, resumir } from '../../dominio/bitacora.js';
import { TIPOS_DE_OPERACION, type Operacion } from '../../dominio/operacion.js';
import { BITACORA, type Bitacora } from '../../dominio/puertos.js';
import type { Usuario } from '../../infraestructura/seguridad/autenticacion.guard.js';

type Peticion = { headers: Record<string, string | undefined>; usuario?: Usuario; token?: string };

const operacion = z.object({
  clave: z.uuid(),
  tipo: z.enum(TIPOS_DE_OPERACION),
  datos: z.record(z.string(), z.unknown()),
  creadaEn: z.iso.datetime({ offset: true }),
});

const lote = z.object({ operaciones: z.array(operacion).min(1).max(100) });

const validar = <T>(esquema: z.ZodType<T>, valor: unknown): T => {
  const r = esquema.safeParse(valor);
  if (!r.success) throw new BadRequestException(z.prettifyError(r.error));
  return r.data;
};

const tienda = (peticion: Peticion) => peticion.usuario?.orgId || null;

/** El guard deja el token de verdad: el de la sesión, o el de la cuenta de la llave de API. */
const tokenDe = (peticion: Peticion) => peticion.token ?? (peticion.headers.authorization ?? '').replace(/^Bearer /, '');

@Controller('v1')
export class SincronizacionController {
  constructor(
    @Inject(SincronizarLote) private readonly sincronizar: SincronizarLote,
    @Inject(BITACORA) private readonly bitacora: Bitacora,
  ) {}

  /** La bandeja offline de Mercado y de Campo manda aquí todo lo pendiente al volver la señal. */
  @Post('sincronizacion/lotes')
  @HttpCode(200)
  async lote(@Body() cuerpo: unknown, @Req() peticion: Peticion) {
    const { operaciones } = validar(lote, cuerpo);
    const contexto = { origen: origenDe(undefined, true), tiendaId: tienda(peticion) };
    return { resultados: await this.sincronizar.ejecutar(operaciones as Operacion[], tokenDe(peticion), contexto) };
  }

  /** Para e-commerce y n8n: un pedido por llamada, con la cabecera Idempotency-Key. */
  @Post('pedidos')
  @HttpCode(200)
  async pedido(
    @Headers('idempotency-key') clave: string | undefined,
    @Body() datos: unknown,
    @Req() peticion: Peticion,
    @Headers('x-abasto-origen') origen?: string,
  ) {
    if (!clave || !z.uuid().safeParse(clave).success) {
      throw new BadRequestException('Falta la cabecera Idempotency-Key con un UUID');
    }
    return this.sincronizar.aplicarUna(
      {
        clave,
        tipo: 'pedido.crear',
        datos: validar(z.record(z.string(), z.unknown()), datos),
        creadaEn: new Date().toISOString(),
      },
      tokenDe(peticion),
      { origen: origenDe(origen, false), tiendaId: tienda(peticion) },
    );
  }

  /** Panel › Conecta: lo que entró de afuera para el mayorista de la sesión, lo último primero. */
  @Get('bitacora')
  async verBitacora(@Req() peticion: Peticion) {
    const mayoristaId = peticion.usuario?.orgId;
    if (!mayoristaId) throw new ForbiddenException('Tu cuenta no pertenece a una empresa');
    const entradas = await this.bitacora.delMayorista(mayoristaId, 100);
    return { resumen: resumir(entradas), entradas };
  }
}
