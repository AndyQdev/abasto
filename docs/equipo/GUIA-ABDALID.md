# Guía para Abdalid

Tu área es **calidad y documentación**, más un arreglo chico en el proyector de reportes del Asistente. Son dos tareas. Hazlas tú, porque en la presentación el ingeniero puede preguntarle a cualquiera.

## Tarea 1 · El saldo de las cuentas por cobrar (programación, ~1 h)

**Qué pasa hoy:** cuando el mayorista registra un pago, Cobros publica el evento `cobro.pago_registrado` con lo que se pagó (`centavos`) y lo que todavía se debe (`saldoCentavos`). El proyector del Asistente ignora `saldoCentavos` y calcula el saldo él mismo, restando el pago al saldo guardado. Si un evento se pierde o llega repetido, Reportes y Cobros quedan con saldos distintos.

**Qué cambiar:** en `services/asistente/src/proyector/proyectar.ts`, en el `case 'cobro.pago_registrado'`, que use `saldoCentavos` cuando venga en el evento:

- `saldo_centavos = $4` y `estado = 'pagada'` cuando `$4` es 0.
- Si el evento no trae `saldoCentavos` (eventos viejos), que siga restando como ahora.

**Prueba primero** (regla del proyecto: un bug se arregla escribiendo antes la prueba que lo muestra). En `proyectar.spec.ts`, agrega un caso: un `cobro.pago_registrado` con `saldoCentavos: 0` deja la cuenta `pagada` y con saldo 0, sin importar el saldo que tenía guardado.

**Comandos:**
```bash
pnpm install
pnpm --filter @abasto/asistente test        # tienen que pasar todas
pnpm --filter @abasto/asistente arquitectura
```

**Cómo explicarlo si te preguntan:** es CQRS. Cobros es el dueño del dato (el saldo); Reportes es una vista de lectura que se arma escuchando eventos. Lo correcto es copiar el dato del dueño, no recalcularlo.

## Tarea 2 · Pruebas de aceptación en la nube (calidad, ~1 h)

Recorre la demo en el despliegue y anota el resultado de cada caso de uso (bien, falla, observación). Los casos están en `docs/iconix/casos-de-uso.md`. Los usuarios de prueba son los del `README.md`, con la clave `abasto123`.

- Panel: https://panel.34-136-24-10.sslip.io
- Superadmin: https://superadmin.34-136-24-10.sslip.io

Deja el resultado en una tabla (caso de uso · qué hiciste · resultado · fecha) y pásasela a Jhoel. Va como evidencia en el capítulo 8 del documento.

## Para defender lo demás

Lee el capítulo 4 (organización) y el 5 a 8 (ICONIX) del documento. Tu área es la documentación y los diagramas: tienes que poder explicar qué es un diagrama de robustez (frontera, control, entidad) y cómo se pasa de un caso de uso a la secuencia y a las clases.
