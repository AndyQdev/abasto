import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
// Solo /salud se consulta desde el navegador (Superadmin); el GraphQL lo llama el Router
app.enableCors({ origin: (process.env.ORIGENES_PERMITIDOS ?? 'http://localhost:5174').split(','), methods: ['GET'] });
const puerto = Number(process.env.PORT ?? 8083);
await app.listen(puerto, '0.0.0.0');
console.log(`Cobros escuchando en http://localhost:${puerto} (GraphQL en /graphql)`);
