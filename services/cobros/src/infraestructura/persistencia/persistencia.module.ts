import { Global, Module } from '@nestjs/common';
import { PrismaServicio } from './prisma.servicio.js';

/** Una sola conexión a Postgres para todo Cobros: los cobros de la saga (public) y «Mi negocio» (negocio). */
@Global()
@Module({ providers: [PrismaServicio], exports: [PrismaServicio] })
export class PersistenciaModule {}
