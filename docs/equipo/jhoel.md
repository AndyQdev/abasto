# Jhoel · estado

Actualizado: 31/10/2026 · en main (reparto nuevo: toda la IA)

## Estoy en
Entrenar el modelo de visión con TensorFlow (requisito de deep learning). Buscar por foto ya funciona con los vectores del catálogo real.

## Terminé
- Buscar por foto con el catálogo real: `ml/src/abasto_ml/vision/catalogo.py` saca un vector por cada uno de los 27 productos de Abasto desde su foto (MobileNetV3 preentrenado). Con fotos de celular simuladas (recorte, giro, luz y desenfoque) acierta el primero 162/162. `reconocerProducto` ya devuelve resultados.
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
- Andrés: agregué una línea en `apps/panel-shell/src/navegacion.ts` (`tableros`, remoto inteligencia) para el menú de Tableros.
- Andrés: agregué `expo-image-manipulator` y `jpeg-js` en `apps/app/package.json` (reducen la foto a 224×224 antes del modelo). `expo-image-manipulator` es nativo: hay que volver a correr `npx expo run:android` una vez.
- Andrés: en Buscar por foto, `reconocerProducto(uri)` junto a `leerTexto(uri)`, y después `combinarConTexto(porImagen, buscarPorTextoLeido(productos, texto).map((p) => p.codigo))`. `reconocerProducto` ya reconoce los 27 productos de Abasto (AB-xxx).
- Una `ANTHROPIC_API_KEY` para la demo y para medir el Analista (meta 18/20).

## Sigue
1. Entrenar con TensorFlow (fotos del catálogo aumentadas y, si hay, fotos de tienda) y comparar contra los vectores.
2. CU-13 de punta a punta, seguridad del MCP y evaluación de las 20 preguntas.
3. ICONIX de CU-13, CU-14 y la IA de CU-05.
