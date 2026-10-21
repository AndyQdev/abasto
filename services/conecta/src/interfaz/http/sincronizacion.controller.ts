import { BadRequestException, Body, Controller, Headers, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { SincronizarLote } from '../../aplicacion/sincronizar-lote.js';
import { TIPOS_DE_OPERACION, type Operacion } from '../../dominio/operacion.js';

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

const tokenDe = (peticion: { headers: Record<string, string | undefined> }) =>
  (peticion.headers.authorization ?? '').replace(/^Bearer /, '');

@Controller('v1')
export class SincronizacionController {
  constructor(@Inject(SincronizarLote) private readonly sincronizar: SincronizarLote) {}

  /** La bandeja offline de Mercado y de Campo manda aquí todo lo pendiente al volver la señal. */
  @Post('sincronizacion/lotes')
  @HttpCode(200)
  async lote(@Body() cuerpo: unknown, @Req() peticion: { headers: Record<string, string | undefined> }) {
    const { operaciones } = validar(lote, cuerpo);
    return { resultados: await this.sincronizar.ejecutar(operaciones as Operacion[], tokenDe(peticion)) };
  }

  /** Para e-commerce y n8n: un pedido por llamada, con la cabecera Idempotency-Key. */
  @Post('pedidos')
  @HttpCode(200)
  async pedido(
    @Headers('idempotency-key') clave: string | undefined,
    @Body() datos: unknown,
    @Req() peticion: { headers: Record<string, string | undefined> },
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
    );
  }
}
