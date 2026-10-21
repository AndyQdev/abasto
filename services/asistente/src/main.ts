import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
// El Panel (Inteligencia) y el Superadmin llaman a Asistente desde el navegador
app.enableCors({
  origin: (process.env.ORIGENES_PERMITIDOS ?? 'http://localhost:5170,http://localhost:5172,http://localhost:5174').split(','),
  allowedHeaders: ['authorization', 'content-type', 'mcp-protocol-version'],
  exposedHeaders: ['content-disposition'],
});
const puerto = Number(process.env.PORT ?? 8085);
await app.listen(puerto, '0.0.0.0');
console.log(`Asistente escuchando en http://localhost:${puerto} (MCP en /mcp)`);
