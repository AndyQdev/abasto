import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
// Mercado y Campo llaman directo a Conecta para sincronizar
app.enableCors({
  origin: (process.env.ORIGENES_PERMITIDOS ?? 'http://localhost:5173').split(','),
  allowedHeaders: ['authorization', 'content-type', 'idempotency-key'],
});
const puerto = Number(process.env.PORT ?? 8084);
await app.listen(puerto, '0.0.0.0');
console.log(`Conecta escuchando en http://localhost:${puerto}`);
