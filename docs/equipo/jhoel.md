# Jhoel · estado

Actualizado: 31/10/2026 · en main (reparto nuevo: toda la IA)

## Estoy en
CU-13 de punta a punta y seguridad del MCP.

## Terminé
- Buscar por foto con el catálogo real: `ml/src/abasto_ml/vision/catalogo.py` saca un vector por cada uno de los 27 productos de Abasto desde su foto (MobileNetV3 preentrenado). Con fotos de celular simuladas (recorte, giro, luz y desenfoque) acierta el primero 162/162. Además se entrena con TensorFlow el clasificador (transfer learning) con fotos de celular simuladas, y `reconocerProducto` mezcla las dos señales (`mezclarConClasificador`).
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
- Andrés (aviso, 31/10, lo pidió Jhoel al probar): cada cuenta entra a la app web que le toca según su rol. `appQueLeToca` en `packages/sesion` (prueba en `apps/superadmin/src/roles.spec.ts`); `main.tsx` del Panel y del Superadmin redirigen al mayorista al Panel y al admin al Superadmin. En el Superadmin: «Cerrar sesión y entrar con otra cuenta» en el aviso de «solo para el equipo» (antes no había cómo salir) e «Ir al Panel Mayorista» en el menú para quien es las dos cosas.
- Andrés: agregué una línea en `apps/panel-shell/src/navegacion.ts` (`tableros`, remoto inteligencia) para el menú de Tableros.
- Andrés: agregué `expo-image-manipulator` y `jpeg-js` en `apps/app/package.json` (reducen la foto a 224×224 antes del modelo). `expo-image-manipulator` es nativo: hay que volver a correr `npx expo run:android` una vez.
- Andrés (aviso, 31/10): cambié 4 líneas de `apps/app/src/pantallas/BuscarPorFoto.tsx` para que use `reconocerProducto` junto a `leerTexto` y ordene con `productosPorFoto` (de `src/ia`). Si la pantalla cambia, mantén esa llamada.
- Una `ANTHROPIC_API_KEY` para la demo y para medir el Analista (meta 18/20).

## Sigue
1. Si hay fotos sacadas en tienda: afinar con `entrenar.py` y medir con fotos reales.
2. CU-13 de punta a punta, seguridad del MCP y evaluación de las 20 preguntas.
3. `docs/trazabilidad.md` y ensayo de la demo.
