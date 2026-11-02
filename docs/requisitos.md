# Requisitos del ingeniero y dónde se cumplen

Salen de la clase del 15/10, en `transcripcion-audio-v2.md`. Si un cambio hace que uno de estos puntos deje de cumplirse, no se hace sin hablarlo entre los dos.
Al 29/10: ✅ hecho y con prueba · ⚠️ en curso.

| Requisito | Dónde se cumple | Dueño | Estado |
|---|---|---|---|
| Microservicios, al menos uno en Spring Boot, uno en NestJS y uno en PHP | Pedidos (Spring Boot), Cobros, Conecta y Asistente (NestJS), Catálogo (Laravel) | los dos | ✅ |
| Microfrontends con un shell y al menos React, Angular y un tercero | Panel: Shell en React que carga Gestión (Angular) e Inteligencia (Vue) como Web Components | Andrés (Shell, Gestión) · Jhoel (Inteligencia) | ✅ |
| GraphQL obligatorio en el sistema de gestión | El Panel lee y escribe por el Apollo Router (GraphQL federado de Pedidos, Catálogo y Cobros) | Andrés | ✅ |
| Funcionalidades construidas como agentes | Asistente: los agentes vigilan el negocio y proponen acciones; el mayorista las aprueba en Inteligencia y n8n las ejecuta (CU-14) | Jhoel | ✅ base |
| IA local en dispositivos móviles | App de clientes, todo dentro del teléfono y sin internet: el asistente de compra entiende pedidos, recetas y fotos con un modelo de lenguaje local elegido según el teléfono (llama.rn: LFM2.5-VL, Qwen3.5, Gemma 4); ML Kit lee etiquetas y el modelo TFLite propio reconoce productos (`apps/app/src/ia`, `docs/ia-local.md`) | Jhoel | ✅ |
| IA local en el navegador | Inteligencia: la pregunta por voz se transcribe con Whisper dentro del navegador; el audio no sale del equipo | Jhoel | ✅ |
| Funcionar sin señal en web y móvil, con sincronización | Web: el Panel es PWA (service worker y cambios guardados). Móvil: la app guarda el catálogo y el carrito, y los pedidos salen por una bandeja cuando vuelve la señal | Andrés | ✅ |
| Idempotencia (que nada se registre dos veces) | Toda escritura que llega de afuera trae `Idempotency-Key`; Conecta (DynamoDB) y los inbox de cada servicio descartan repetidos | Andrés | ✅ |
| Transacción entre 3 o más microservicios (saga) | Hacer un pedido: Pedidos orquesta → Catálogo reserva stock → Cobros autoriza crédito o genera el QR; si algo falla, compensa (CU-06) | Andrés | ✅ |
| ML supervisado y no supervisado | `ml/`: demanda (GradientBoosting) y mora (regresión logística) son supervisados; segmentos de tiendas (K-means) no es supervisado | Jhoel | ✅ |
| Deep learning con TensorFlow sobre imagen | `ml/src/abasto_ml/vision/catalogo.py`: MobileNetV3 (transfer learning) con el clasificador entrenado en TensorFlow sobre fotos de celular simuladas desde las fotos del catálogo → TFLite en la app. Métricas en `apps/app/assets/modelos/metricas.json`. `entrenar.py` afina con fotos sacadas en tienda | Jhoel | ✅ |
| Automatización con n8n | Pedido por WhatsApp → n8n → Conecta → Pedidos; las acciones aprobadas de los agentes también salen por n8n (CU-11, CU-14) | Andrés (WhatsApp) · Jhoel (agentes) | ✅ |
| Reportes generativos por texto o voz, en pantalla y en Excel | Inteligencia › Reportes: la pregunta se convierte en SQL con guardia, se muestra en tabla y gráfico, y se exporta a Excel (CU-13) | Jhoel | ✅ |
| Protocolo MCP | Servidor MCP `abasto-reportes` del Asistente: un agente externo (Claude, por ejemplo) le pregunta a los datos del mayorista. Falta un MCP de Conecta para que un e-commerce compre (CU-10) | Jhoel · Andrés | ✅ reportes · ⚠️ compras |
| Postgres, MongoDB y DynamoDB (nada de MySQL) | Postgres: Pedidos, Cobros, Asistente y Keycloak. MongoDB: Catálogo. DynamoDB: Conecta | los dos | ✅ |
| Una sola cuenta para entrar a todas las apps | Keycloak (OIDC + PKCE): entrar al Panel abre el Superadmin sin volver a pedir la contraseña; la app usa la misma cuenta | Andrés | ✅ |
| Arquitecturas de código DDD, hexagonal y clean | Cobros es DDD, Pedidos es hexagonal y Catálogo es clean. ArchUnit, Deptrac y dependency-cruiser lo revisan en la CI | los dos | ✅ |
| Arquitectura de datos para los reportes | CQRS: el proyector del Asistente escucha los eventos y arma la base `reportes`; los reportes no leen las bases de los servicios | Jhoel | ✅ |
| ICONIX | `docs/iconix`: casos de uso, robustez y secuencia | los dos | ⚠️ al día en la tabla; faltan diagramas de más casos |

## Las tres interfaces (replanteo del 29/10)

- **App de clientes** (`apps/app`, Expo, Android e iPhone): es el producto. Las tiendas y las personas buscan (también con una foto), piden a cualquier mayorista, pagan y siguen el pedido. Ven los precios de un mayorista cuando él las aprueba (red privada). Abasto también vende ahí como «vendedor de la casa» mientras no hay muchos afiliados.
- **Panel** (web PWA): cada mayorista gestiona sus productos, clientes, pedidos, compras, cuentas e inteligencia.
- **Superadmin** (web): Abasto aprueba a los mayoristas que se registran y mira la tracción.

«Abasto vende» no reemplaza al marketplace: Abasto es un mayorista más dentro del sistema.
