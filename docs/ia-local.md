# IA local de Abasto (teléfono)

Dueño: Jhoel. Código en `apps/app/src/ia/`. Cumple los requisitos «IA local en dispositivos móviles», «funcionar sin señal» y «deep learning con TensorFlow sobre imagen» de `docs/requisitos.md`.

## Qué hace

Abasto entiende lo que una persona necesita **comprar, abastecer o producir** y lo convierte en un carrito con productos reales del catálogo:

| Tipo de cliente (`docs/plan-mi-negocio.md`) | Ejemplo | Qué arma |
|---|---|---|
| Hogar | «algo para lavar ropa», la foto de un producto, una receta de TikTok pegada | los productos y, si es receta, sus ingredientes |
| Tienda | «3 cajas de aceite, 2 fardos de arroz y 5 docenas de leche», una lista escrita a mano en foto | cada producto en su presentación mayorista |
| Productor | «quiero hacer 300 salteñas», la foto de una torta «para 20 personas con relleno de chocolate blanco» | los insumos escalados desde una receta de referencia, en quintales, maples, baldes… |

No es un chatbot: la salida es siempre una **propuesta de carrito** que la persona revisa y confirma.

## Cómo está armada

```
texto / receta pegada / foto
   │
   ├─ Entender ──► modelo de lenguaje local (llama.rn + GGUF, según el teléfono)   ─┐
   │               └─ si no hay modelo o no entiende: reglas en español (siempre)  ─┼─► Intencion (JSON)
   │               └─ solo foto y sin modelo que vea: MobileNetV3 (TFLite) + ML Kit ─┘
   ├─ Completar ──► receta sin ingredientes → receta de referencia escalada con aritmética
   └─ Catalogar ──► producto, presentación y cantidad por código (medidas, quintal = 46 kg…)
                     └─ Propuesta: líneas + «lo que supusimos» + «no lo tenemos»
```

Reglas que hacen que **no invente**:
- El modelo solo devuelve un JSON atado a `ESQUEMA_DE_INTENCION` (llama.rn lo convierte en gramática: no puede escribir otra cosa). Nunca devuelve precios, códigos ni productos.
- Lo que devuelve se valida (`leerRespuesta`): números negativos, unidades o envases que no existen se descartan.
- El producto, la presentación y la cantidad los calcula el código (`catalogar.ts`) con las medidas de `packages/comercio`.
- Lo que se supuso se muestra («No dijiste cuántas…», «Usamos la receta de referencia…»), y lo que no vendemos se dice.

## Modelos según el teléfono

`src/ia/local/modelos.json` es el manifiesto. Todos son GGUF con proyector de visión (texto y fotos) y corren con **llama.rn** (llama.cpp):

| Nivel | Memoria del teléfono | Modelo | Descarga |
|---|---|---|---|
| ninguno | < 2,5 GB o procesador de 32 bits | — (reglas + ML Kit + MobileNetV3) | 0 |
| básico | ≥ 2,5 GB | LFM2.5-VL 450M | ~330 MB |
| medio | ≥ 3,5 GB | Qwen3.5 0.8B | ~740 MB |
| alto | ≥ 7,5 GB | Qwen3.5 2B | ~1,9 GB |
| máximo | ≥ 11 GB | Gemma 4 E2B (y E4B con ≥ 12 GB) | ~4,1 GB / ~6 GB |

Si no entra en el espacio libre, se baja uno más liviano. La persona puede elegir otro en Cuenta › IA en tu teléfono.

**Agregar o cambiar un modelo:** una entrada más en `modelos.json` (ruta fijada al commit, bytes y SHA-256 del archivo). No hay que tocar el motor ni las pantallas. Lo mismo para cambiar de motor: implementar `Interprete` (`local/motor.ts`).

## Distribución de los modelos

- Se bajan una sola vez desde **Hugging Face**, con la ruta fijada a un commit (no cambian solos), a la carpeta privada de la app. Después todo anda sin internet.
- Por qué no Google Drive: los archivos de más de 100 MB pasan por una página de «no se pudo analizar en busca de virus», no se pueden reanudar y tienen cuotas de descarga.
- Espejo propio opcional: `EXPO_PUBLIC_IA_MODELOS_URL` (en `apps/app/.env.local`) reemplaza a `https://huggingface.co` con la misma estructura de carpetas (sirve un bucket S3/MinIO o cualquier servidor estático).

## Dónde tocar para mejorar la precisión (trabajo de datos)

- Recetas (03/11): una sola lista en `src/ia/entender/recetas.ts`. Primero las 20 plantillas de Mi negocio (`packages/comercio/src/mi-negocio/plantillas.ts`, de Andrés, con fuentes) y después las 18 de `recetas.json` que no están ahí (pan batalla, torta, almuerzo de pensión, salchipapa con huevo, silpancho, picante de pollo, fricasé, chairo, sopas de fideo, quinua y lenteja, arroz con leche, tucumanas, buñuelos, milanesa, falso conejo, lomo montado y humintas; cantidades estimadas). Cada insumo trae los códigos del catálogo que lo venden: `catalogar` elige por código y la presentación que mejor calza (12 kg de harina → la arroba). Para sumar una receta: agrégala a `recetas.json` con los `codigos` de cada insumo (la prueba lo exige).
- `src/ia/entender/con-modelo.ts`: las instrucciones del modelo.
- `src/ia/entender/reglas.ts`: lo que se entiende sin modelo.
- `ml/src/abasto_ml/vision/`: el reconocedor de productos por foto (TensorFlow → TFLite).
- Probar con el teléfono: Buscar › ✨ «Pídelo con tus palabras».

## Probar

- `cd apps/app && npx jest src/ia && npx tsc --noEmit`.
- En el teléfono (hace falta compilar una vez: entró llama.rn, nativo): `npx expo run:android`, luego Cuenta › IA en tu teléfono › Bajar (mejor con Wi-Fi) y Buscar › ✨.
