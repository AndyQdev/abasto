# Notificaciones push

Lo pidió el ingeniero el 10/11. La app de las tiendas recibe notificaciones aunque esté cerrada:

- **Pedidos:** cada paso de su pedido le avisa (confirmado, en preparación, en camino, entregado, rechazado, pago con QR recibido, reclamo respondido). Las de un mismo pedido ocupan un solo lugar en la bandeja: cada paso reemplaza al anterior, como en las apps de delivery. **«Va en camino» queda fija:** no se puede deslizar y se va sola cuando el pedido llega.
- **Promociones:** Abasto escribe una en Superadmin › Promociones y le llega a todos los teléfonos con la app. Si tiene producto, tocarla abre su ficha.

## Cómo funciona

```
Pedidos ──pedido.*──▶ RabbitMQ (abasto.eventos) ──▶ cola conecta.notificaciones ──▶ Conecta ──▶ Firebase (FCM) ──▶ teléfonos de la tienda
Superadmin › Promociones ──POST /v1/admin/promociones──▶ Conecta ──▶ Firebase ──▶ todos los teléfonos
App al entrar ──PUT /v1/dispositivos (token de Firebase)──▶ Conecta (DynamoDB, partición DISPOSITIVOS)
```

| Pieza | Dónde |
|---|---|
| Qué se dice en cada paso | `services/conecta/src/dominio/notificacion.ts` (`notificacionDePedido`) |
| Registrar teléfonos, avisar eventos y promociones | `services/conecta/src/aplicacion/notificaciones.ts` |
| Envío a Firebase (API HTTP v1, sin SDK: JWT firmado con la cuenta de servicio) | `services/conecta/src/infraestructura/push/enviador.firebase.ts` |
| Cola durable `conecta.notificaciones` (`pedido.*`, `cobro.*`) | `services/conecta/src/infraestructura/mensajeria/notificaciones.rabbitmq.ts` |
| Teléfonos, promociones y «este evento ya avisó» | `services/conecta/src/infraestructura/dynamodb/notificaciones.dynamodb.ts` |
| Canales, permiso, token, a dónde lleva cada toque y la fija de «en camino» | `apps/app/src/notificaciones.ts` y `apps/app/src/VigiaDeNotificaciones.tsx` |
| Estado y «Probar una notificación» | App › Cuenta › Notificaciones |
| Promociones y últimas notificaciones enviadas | `apps/superadmin/src/pantallas/Promociones.tsx` |

**Detalles que importan:**
- **Lo que garantiza que nada se repita ni se cruce:**
  - **Un aviso por evento:** RabbitMQ puede entregar dos veces el mismo evento. Conecta anota `AVISO#<id del evento>` con una escritura condicional, así no suena dos veces.
  - **Una promoción por clave:** se manda con `Idempotency-Key`. Un doble clic devuelve la misma promoción y no vuelve a sonar.
  - **Un teléfono, una cuenta:** si entra otra cuenta en el mismo teléfono, el token pasa a esa cuenta. Al cerrar sesión, la app lo da de baja.
  - **Tokens que ya no sirven:** si Firebase dice que un token no existe (desinstalaron la app), Conecta lo borra.
- **Cómo se ven en la bandeja:**
  - **Una notificación por pedido:** el servidor manda `android.notification.tag = pedido-<id>`. La app usa ese mismo identificador para la fija, así las dos ocupan el mismo lugar en la bandeja.
  - **La fija de «en camino»:** la pone la app con `sticky: true` (Android: `setOngoing`), en el canal «Pedido en camino», sin sonido. La notificación del servidor ya sonó.
  - **Cuándo aparece:** se pone al abrir la app, al volver a ella y con cada aviso en tiempo real. Con la app cerrada, se ve la del servidor, que no se va al tocarla.
- **Canales de Android:** «Tus pedidos» suena y vibra. «Promociones» y «Pedido en camino» se pueden silenciar aparte desde Ajustes.

## Configurar Firebase (una vez)

Android solo recibe notificaciones push por Firebase Cloud Messaging, que es gratis.

1. https://console.firebase.google.com → **Agregar proyecto** «Abasto».
2. **Agregar app → Android**, paquete `bo.abasto.app`. Descargar `google-services.json` y guardarlo en `apps/app/google-services.json`.
3. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Guardarla en `.firebase/firebase.json` (en la raíz del repo).

Los dos archivos están en `.gitignore`: **nunca van al repo**.

- `google-services.json` entra al compilar la app (`app.config.js`), así que hay que recompilar: `npx expo prebuild --platform android` y `npx expo run:android`.
- La cuenta de servicio la lee Conecta (`FIREBASE_CREDENCIALES`, montada en `/secretos`), así que hay que reiniciarlo: `docker compose --profile servicios up -d conecta`.

**Sin los archivos todo funciona igual, en modo prueba:**
- Conecta anota lo que mandaría y no sale a ningún teléfono.
- El Superadmin muestra «Modo prueba».
- Cuenta dice que esa versión de la app se armó sin Firebase.

**En la nube (AWS, Conecta):** copiar la cuenta de servicio a `infra/despliegue/aws/secretos/firebase.json` en la máquina y correr `docker compose up -d conecta`. `compose.yml` ya la monta.

## Probar

- Automáticas:
  - `pnpm --filter @abasto/conecta test`: qué se dice, a quién, sin repetir, tokens viejos y el envío a Firebase con un servidor de mentira.
  - `npx jest src/notificaciones.test.ts` en `apps/app`: la fija, los toques y el registro.
  - `pnpm --filter @abasto/superadmin test`.
- De punta a punta: `e2e/pruebas/notificaciones.spec.ts`. Un pedido de Doña Rosa recorre sus pasos y le llegan los cuatro avisos; después se manda una promoción desde el Superadmin.
- En el teléfono o el emulador con Google Play:
  1. Entrar a la app y aceptar el permiso.
  2. En Cuenta › Notificaciones, «Probar una notificación».
  3. Hacer un pedido y avanzarlo desde el Panel (Confirmar → Preparar → Despachar → Entregar). Con «Despachar» queda la fija; con «Entregar» se va y llega «¡Llegó tu pedido!».

**iPhone:** necesita una cuenta de Apple Developer para APNs. No está configurado. En Android funciona todo.
