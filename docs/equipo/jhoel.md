# Jhoel · estado

Actualizado: 30/10/2026 · en main (reparto nuevo: toda la IA)

## Estoy en
Modelo propio de visión para buscar por foto (requisitos «IA local en móvil» y «deep learning con TensorFlow»): falta sacar las fotos de los 10 productos y entrenar.

## Terminé
- CU-14 Agentes: Cobranza, Reposición (stock que no alcanza para 7 días según la demanda del ML → pedido para 2 semanas) y Catálogo (sin stock → pausar). Lo que ya espera una decisión no se vuelve a proponer.
- T20 «Monitorear mi negocio»: `POST /v1/agentes/monitorear` corre todos los agentes; botón «Revisar ahora» en Inteligencia › Agentes.
- `GET /v1/tableros` del Asistente: demanda prevista con días de stock, segmentos, ventas de 30 días y cobranza.
- `reconocerProducto(fotoUri, maximo = 5)` → `[{ codigo, confianza }]` en `apps/app/src/ia` (TFLite + vectores del catálogo, sin internet). En la vista web devuelve `[]`.
- `combinarConTexto(porImagen, codigosPorTexto)`: sube a los productos cuyo nombre leyó ML Kit en la etiqueta.
- `ml/src/abasto_ml/vision/entrenar.py`: MobileNetV3 con dos salidas (código de producto y vector de 576), exporta `productos.tflite`, `etiquetas.json` y `vectores.json` a `apps/app/assets/modelos/`. Prueba de paridad Keras = TFLite.
- Antes del reparto: proyector con entrega y contra entrega (#7), foto por producto en Catálogo (#8), Panel PWA (#9) e ICONIX completo.

## Cambié en contratos
- `contracts/openapi/asistente.yaml`: `/v1/agentes/monitorear` y `/v1/tableros` (solo agregué; nada cambió de lo que existía).

## Necesito del otro
- Andrés: agregué `expo-image-manipulator` y `jpeg-js` en `apps/app/package.json` (reducen la foto a 224×224 antes del modelo). `expo-image-manipulator` es nativo: hay que volver a correr `npx expo run:android` una vez.
- Andrés: en Buscar por foto, `reconocerProducto(uri)` junto a `leerTexto(uri)`, y después `combinarConTexto(porImagen, buscarPorTextoLeido(productos, texto).map((p) => p.codigo))`. Mientras el modelo no está entrenado, `reconocerProducto` devuelve `[]` y la pantalla sigue funcionando solo con el texto.
- Una `ANTHROPIC_API_KEY` para la demo y para medir el Analista (meta 18/20).

## Sigue
1. Fotos (20 por producto) y entrenamiento en Colab → reemplazar el modelo vacío.
2. Pantalla de Tableros en Inteligencia y su entrada en el menú del Shell.
4. CU-13 de punta a punta, seguridad del MCP y evaluación de las 20 preguntas.
5. ICONIX de CU-13, CU-14 y la IA de CU-05.
