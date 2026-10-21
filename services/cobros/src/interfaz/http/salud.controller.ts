import { Controller, Get } from '@nestjs/common';
import { Publico } from '../../infraestructura/seguridad/autenticacion.guard.js';

@Controller('salud')
export class SaludController {
  @Publico()
  @Get()
  salud() {
    return { servicio: 'cobros', estado: 'ok', hora: new Date().toISOString() };
  }
}
