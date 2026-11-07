# Jhoel · estado

Actualizado: 07/11/2026 · en main (reparto nuevo: toda la IA)

## Estoy en
Despliegue en tres nubes (lo pidió el ingeniero): primero AWS, después Azure y al final Google Cloud. Plan y pasos en «Despliegue en la nube» del README.

## Terminé
- Reportes sin llave (07/11, lo pidió Andrés): el modelo simulado ya no responde las ventas del mes a cualquier pregunta. Si no la reconoce dice «No entendí la pregunta» con 5 ejemplos (HTTP 422), y reconoce más: riesgo de mora, sin stock, demanda prevista, lo más vendido, pedidos rechazados, segmentos y pedidos.
- Reportes sin señal (03/11): sin red, lo dicho por voz (Whisper en el navegador) queda en «Esperan señal» y se responde solo al volver; si ya hay un reporte guardado de esa pregunta se muestra con su fecha. Los últimos 10 reportes quedan en el equipo (por empresa) y se ven sin señal; Excel pide señal.
- Tableros (03/11): de 4 a 9 tarjetas en Inteligencia › Tableros: quién te debe, riesgo de que te paguen tarde (el modelo de mora ahora corre en `abasto-ml-nocturno` con las cuentas reales y escribe `riesgo_mora`, migración 004), lo que más se vende, cómo te pagan y tiendas nuevas / que dejaron de comprar. El Analista y el MCP también pueden leer `riesgo_mora`.
- Agentes → n8n (03/11): flujo `infra/n8n/flujos/acciones-de-agentes.json`. Al aprobar en Inteligencia › Agentes, n8n pausa el producto en Catálogo (por el Router, con la sesión de quien aprobó) o deja listo el WhatsApp de cobranza o el pedido al proveedor; la pantalla muestra lo que hizo y «Abrir WhatsApp». Con n8n apagado la propuesta queda aprobada y lo dice. Probado contra n8n real.
- IA local (01/11): asistente de compra que entiende pedidos, recetas y fotos y arma el carrito con productos reales. Modelos según el teléfono (LFM2.5-VL 450M, Qwen3.5 0.8B/2B, Gemma 4 E2B/E4B) con llama.rn, bajados una vez de Hugging Face y sin internet después; respaldo con reglas en español, ML Kit y MobileNetV3. El modelo nunca elige productos ni precios: eso lo calcula el código. `docs/ia-local.md`.
- Buscar por foto (03/11): 137 de los 138 productos con 248 fotos reales (las 27 de tienda del catálogo, fotos de referencia de tiendas bolivianas, de Wikimedia Commons y de tiendas web, todas revisadas a mano; fuera solo la gallina criolla, que en foto es igual al pollo entero; las ilustraciones 3D genéricas no se usan). Detalle en `ml/ENTRENAMIENTO.md`. Antes: `ml/src/abasto_ml/vision/catalogo.py` saca un vector por cada producto desde su foto (MobileNetV3 preentrenado). Con fotos de celular simuladas (recorte, giro, luz y desenfoque) acierta el primero 162/162. Además se entrena con TensorFlow el clasificador (transfer learning) con fotos de celular simuladas, y `reconocerProducto` mezcla las dos señales (`mezclarConClasificador`).
- CU-14 Agentes: Cobranza, Reposición (stock que no alcanza para 7 días según la demanda del ML → pedido para 2 semanas) y Catálogo (sin stock → pausar). Lo que ya espera una decisión no se vuelve a proponer.
- T20 «Monitorear mi negocio»: `POST /v1/agentes/monitorear` corre todos los agentes; botón «Revisar ahora» en Inteligencia › Agentes.
- Inteligencia › Tableros (`GET /v1/tableros`): ventas de 30 días, lo que se te puede acabar esta semana, demanda prevista (ML supervisado) y segmentos de tiendas (K-means).
- `reconocerProducto(fotoUri, maximo = 5)` → `[{ codigo, confianza }]` en `apps/app/src/ia` (TFLite + vectores del catálogo, sin internet). En la vista web devuelve `[]`.
- `combinarConTexto(porImagen, codigosPorTexto)`: sube a los productos cuyo nombre leyó ML Kit en la etiqueta.
- `ml/src/abasto_ml/vision/entrenar.py`: MobileNetV3 con dos salidas (código de producto y vector de 576), exporta `productos.tflite`, `etiquetas.json` y `vectores.json` a `apps/app/assets/modelos/`. Prueba de paridad Keras = TFLite.
- Antes del reparto: proyector con entrega y contra entrega (#7), foto por producto en Catálogo (#8), Panel PWA (#9) e ICONIX completo.

## Cambié en contratos
- `contracts/openapi/asistente.yaml`: `/v1/agentes/monitorear` y `/v1/tableros` (solo agregué; nada cambió de lo que existía).

## Necesito del otro
- Andrés (aviso, 07/11, despliegue en AWS): es infra tuya, te cuento qué cambié. Nuevo `infra/despliegue/aws/` (compose, Caddy con HTTPS por sslip.io, router.yaml con las webs públicas, `preparar.sh`) y `infra/despliegue/construir-webs.mjs`. En lo que ya existía:
  - `packages/sesion`: el emisor de Keycloak y las direcciones de las apps salen de `VITE_KEYCLOAK_URL`, `VITE_PANEL_URL` y `VITE_SUPERADMIN_URL`; sin ellas, las de siempre.
  - Superadmin `servicios.ts`: la salud de cada servicio sale de `VITE_SALUD_<SERVICIO>`.
  - Shell: `sw.ts` reconoce a Keycloak por su dirección (antes por el puerto 8180, que en la nube no existe y terminaba guardando el login en caché) y `remotos.json` quedó fuera del precache (`vite.config.ts`): así un remoto nuevo se ve sin reconstruir el Shell.
  - `infra/keycloak/al-dia.mjs`: paso 7, con `PANEL_URL`, `GESTION_URL`, `INTELIGENCIA_URL` y `SUPERADMIN_URL` agrega esas direcciones a los clientes; la clave de admin sale de `KEYCLOAK_ADMIN_CLAVE`. En local no cambia nada.
  - README: sección «Despliegue en la nube».
- Andrés (aviso, 03/11, n8n de los agentes): en `package.json` de la raíz, `pnpm n8n` ahora también activa los flujos (`update:workflow --all --active=true` y reinicia n8n; antes quedaban importados pero inactivos, también el de WhatsApp). En `docker-compose.yml`: `ROUTER_URL` en n8n y `N8N_WEBHOOK_ACCIONES` del Asistente con valor por defecto `http://n8n:5678/webhook/acciones-agentes`. Nada de tu flujo de WhatsApp cambió.
- Andrés (aviso, 03/11): el asistente de compra lee tus `PLANTILLAS` de `packages/comercio` como recetas (solo lectura, no cambié nada tuyo). Si cambias `clave`, `nombre`, `unidad` o los `codigos` de un insumo, corre `npx jest src/ia` en `apps/app`. En `App.tsx` (merge del 02/11) quedaron tu versión, `ProveedorDeIaLocal` y las pantallas `Asistente` e `IaLocal`; la IA se carga al usarla con `src/ia/perezoso.ts` (respeta tu arreglo de Expo Go).
- Andrés (aviso, 01/11): para la IA local toqué lo mínimo de la app: `App.tsx` (`ProveedorDeIaLocal` y las pantallas `Asistente` e `IaLocal`), `src/navegacion.ts` (las dos rutas), `Buscar.tsx` (botón ✨ «Pídelo con tus palabras» junto a la cámara), `Cuenta.tsx` (tarjeta «IA en tu teléfono»), `app.json` (plugin `llama.rn`) y `package.json` (`llama.rn` 0.13.0-rc.7, `expo-device`, `expo-file-system`). **Nativo:** `npm install` y `npx expo run:android` una vez. En Windows, el CMake de llama.rn pide Python en el PATH (sirve el de `uv`: `uv python find 3.12 --system`) y `npm install` necesita el `tar` de Windows (`C:\Windows\System32` primero en el PATH).
- Andrés (aviso, 31/10, lo pidió Jhoel al probar): cada cuenta entra a la app web que le toca según su rol. `appQueLeToca` en `packages/sesion` (prueba en `apps/superadmin/src/roles.spec.ts`); `main.tsx` del Panel y del Superadmin redirigen al mayorista al Panel y al admin al Superadmin. En el Superadmin: «Cerrar sesión y entrar con otra cuenta» en el aviso de «solo para el equipo» (antes no había cómo salir) ; el Superadmin tiene la misma barra superior que el Panel (Apps → Panel Mayorista si la cuenta es mayorista, nombre y Salir). `asegurar()` de `packages/sesion` confirma la sesión guardada con Keycloak al abrir cada app: si se cerró sesión en otra app y se entró con otra cuenta, ya no se queda con la copia vieja.
- Andrés: agregué una línea en `apps/panel-shell/src/navegacion.ts` (`tableros`, remoto inteligencia) para el menú de Tableros.
- Andrés: agregué `expo-image-manipulator` y `jpeg-js` en `apps/app/package.json` (reducen la foto a 224×224 antes del modelo). `expo-image-manipulator` es nativo: hay que volver a correr `npx expo run:android` una vez.
- Andrés (aviso, 31/10): cambié 4 líneas de `apps/app/src/pantallas/BuscarPorFoto.tsx` para que use `reconocerProducto` junto a `leerTexto` y ordene con `productosPorFoto` (de `src/ia`). Si la pantalla cambia, mantén esa llamada.
- Una `ANTHROPIC_API_KEY` para la demo y para medir el Analista (meta 18/20).

## Sigue
1. Si hay fotos sacadas en tienda: afinar con `entrenar.py` y medir con fotos reales.
2. CU-13 de punta a punta, seguridad del MCP y evaluación de las 20 preguntas.
3. `docs/trazabilidad.md` y ensayo de la demo.
