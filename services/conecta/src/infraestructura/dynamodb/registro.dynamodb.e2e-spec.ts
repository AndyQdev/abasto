// Prueba de integración contra DynamoDB Local. Necesita `pnpm infra` y se corre con `pnpm test:e2e`.
import { randomUUID } from 'node:crypto';
import { crearClienteDynamoDB } from './cliente.js';
import { RegistroDynamoDB } from './registro.dynamodb.js';

describe('RegistroDynamoDB (DynamoDB Local)', () => {
  const registro = new RegistroDynamoDB(crearClienteDynamoDB());

  it('de 20 reservas simultáneas con la misma clave, una sola es nueva', async () => {
    const clave = randomUUID();
    const reservas = await Promise.all(Array.from({ length: 20 }, () => registro.reservar(clave, 'h1')));
    expect(reservas.filter((r) => r.tipo === 'nueva')).toHaveLength(1);
  });

  it('después de completar, un reintento recibe la misma respuesta', async () => {
    const clave = randomUUID();
    await registro.reservar(clave, 'h1');
    await registro.completar(clave, { pedidoId: 'A-1042' });
    expect(await registro.reservar(clave, 'h1')).toEqual({ tipo: 'repetida', respuesta: { pedidoId: 'A-1042' } });
    expect(await registro.reservar(clave, 'otra')).toEqual({ tipo: 'conflicto' });
  });

  it('liberar permite volver a aplicar', async () => {
    const clave = randomUUID();
    await registro.reservar(clave, 'h1');
    await registro.liberar(clave);
    expect(await registro.reservar(clave, 'h1')).toEqual({ tipo: 'nueva' });
  });
});
