# Prompt para el Claude de Jhoel

Actualizado el 01/11. Si ya tienes el repo, pega en Claude Code el prompt de «Retomar (01/11)». Si es una máquina nueva, haz primero «Desde cero». El de 29/10 queda abajo como historia.

## Retomar (01/11: enfoque nuevo de la app)

```text
Soy Jhoel. Trabajo con Andrés en Abasto (2º parcial de Ingeniería de Software II, ICONIX, Grupo #13). La entrega pasó al 10/11/2026 (Andrés lo confirma). Háblame en español con tuteo. Andrés lleva lo comercial y yo la IA; trabajamos los dos directo en main.

Entre el 31/10 y el 01/11 Andrés cambió el enfoque de la app de clientes. Antes de tocar nada:

1. Baja todo: git switch main && git pull --rebase origin main, pnpm install y, dentro de apps/app, npm install (hay dependencias nuevas de prueba). Después pnpm todo y pnpm semilla (el catálogo ahora tiene 49 productos).
2. Lee, en este orden: el bloque «Jhoel, empieza aquí» de docs/equipo/andres.md, docs/plan-mi-negocio.md (el plan nuevo) y apps/app/CLAUDE.md.
3. Explícame en 10 líneas el enfoque nuevo con estas ideas, y dime qué le sirve a mi parte (IA y ML):
   - Abasto es su propio mayorista y la promesa es «no vuelvas a ir al mercado». Los clientes son tres tipos: Hogar (la familia que compra al por mayor), Tienda (abarrotes que revende) y Productor (salteñería, panadería o pensión: compra insumos y vende algo hecho).
   - Al registrarse, el cliente elige su tipo (obligatorio) y el Inicio le muestra lo suyo.
   - «Mi negocio»: una pestaña (Mi casa / Mi tienda / Producción) con el inventario que se llena solo con lo que compra en Abasto. Siguen la caja para vender, el cuaderno de fiado, las recetas con costo por unidad, el planificador («quiero hacer 300 salteñas»), las cuentas de la casa y el respaldo de todo en la base de datos del servidor (sin señal, en el teléfono, y se sube solo).
4. Cambio en mi carpeta: Andrés tocó solo apps/app/src/ia/index.ts para que la app abra en Expo Go (iPhone): ML Kit y TFLite se cargan recién al usarlos y, en Expo Go, la IA queda apagada con un aviso. En Android no cambia nada. Revisa que mi parte siga bien con pnpm test y, en el emulador, con el diagnóstico de la IA (Cuenta → Probar la IA del teléfono).
5. Propón (no implementes todavía, espera mi sí) cómo la IA puede aprovechar lo nuevo, por ejemplo:
   - Reconocer el producto por foto también en la caja rápida de la tienda (vender sin tipear).
   - Estimar «se te acaba el aceite en ~5 días» con los movimientos del inventario (ml/ de demanda).
   - Segmentar clientes por tipo de negocio en Inteligencia.

Reglas de siempre:
- Trabajo directo en main: git pull --rebase origin main al empezar y antes de cada push, commits chicos, nunca --force, nunca borro trabajo de Andrés.
- No toco carpetas de Andrés (mira .github/CODEOWNERS). Si necesito algo, lo escribo en docs/equipo/jhoel.md, en «Necesito del otro».
- Toda funcionalidad nueva lleva su prueba. En apps/app las pruebas de pantallas usan React Native Testing Library 14: render y fireEvent son asíncronos (await).
- Para probar la app en el emulador sigue «Correr» de apps/app/CLAUDE.md. Si al arrancar sale un APK viejo, es la instantánea del emulador: está explicado ahí.
```

## Retomar (29/10: reparto nuevo, todo en main)

```text
Soy Jhoel. Trabajo con Andrés en Abasto, el segundo parcial de Ingeniería de Software II (ICONIX, Grupo #13), que se entrega el 3/11/2026. Háblame en español con tuteo.

Desde el 29/10 cambiaron dos cosas:
- Trabajamos los dos directo en main, sin ramas ni PR.
- Andrés lleva todo lo comercial y yo toda la IA.

1. Baja todo: git switch main && git pull --rebase origin main, y después pnpm install. Si tengo trabajo sin subir en otra rama, ayúdame a pasarlo a main sin perder nada (commit en la rama, git switch main, git merge <rama>, pruebas y push).
2. Lee CLAUDE.md (sobre todo «Dueños» y «Git en main»), docs/requisitos.md, docs/iconix/README.md y el aviso de docs/equipo/andres.md.
3. Lee el CLAUDE.md de mis carpetas: services/asistente, ml, apps/panel-inteligencia y apps/app (de la app solo es mía src/ia/ y assets/modelos/).
4. Levanta el entorno: pnpm todo y pnpm semilla. Si el Panel o la app no me dejan entrar por el cliente abasto-app de Keycloak: pnpm borrar-datos, pnpm todo y pnpm semilla. Corre pnpm test, pnpm test:ml y pnpm e2e.
5. Resúmeme en 10 líneas qué hay en mis carpetas, qué está hecho y qué falta según docs/requisitos.md.
6. Mis tareas, en este orden (son tarjetas de Trello: https://trello.com/b/ABo8gFFG/abasto). Propón cómo encarar la primera y espera a que te diga que sí:
   a. Modelo propio de visión (requisito de deep learning con TensorFlow sobre imágenes). Hay que armar el dataset con fotos de los productos del catálogo, entrenar MobileNetV3 con ml/vision/entrenar.py (en Colab si no me alcanza la máquina) y exportarlo a TFLite en apps/app/assets/modelos. Después va la prueba de paridad Keras = TFLite. En apps/app/src/ia/index.ts tengo que exportar reconocerProducto(fotoUri) → [{ codigo, confianza }]; la pantalla Buscar por foto de Andrés lo combina con leerTexto (ML Kit).
   b. CU-14 Agentes (Cobranza, Reposición, Catálogo y Analista): proponen acciones, el mayorista las aprueba en Inteligencia y n8n las ejecuta.
   c. Inteligencia: tableros de demanda y segmentos con las predicciones de ml/.
   d. CU-13: revisar de punta a punta la pregunta por voz (Whisper en el navegador) → tabla, gráfico y Excel. El proyector ya registra la entrega y el contra entrega.
   e. Asistente: suite de seguridad del MCP y evaluación de las 20 preguntas.
   f. ICONIX: robustez y secuencia de CU-13 y CU-14, y la parte de IA de CU-05.

Reglas:
- Trabajo directo en main. Hago git pull --rebase origin main al empezar y antes de cada push, commits chicos y push seguido. Si hay conflicto junto los dos cambios a mano, nunca uso --force y nunca borro trabajo de Andrés.
- No toco carpetas de Andrés (mira .github/CODEOWNERS). Si necesito algo de él, lo escribo en docs/equipo/jhoel.md, en «Necesito del otro». Si cambio lo que exporta apps/app/src/ia/index.ts o algo de contracts/, también lo anoto ahí.
- Ningún cambio puede dejar un requisito de docs/requisitos.md sin cumplir.
- Toda funcionalidad nueva lleva su prueba. Un bug se arregla escribiendo primero la prueba que lo reproduce.
- Al empezar el día uso /empezar y al terminar /cerrar.
```

## Desde cero (máquina nueva, 10 minutos a mano)

1. Instala Node 22+, Docker Desktop, git y uv. Para probar la app en tu Android: Android Studio (SDK y adb), JDK 17 y el teléfono con depuración USB.
2. `corepack enable && corepack prepare pnpm@12.3.4 --activate`
3. `git clone https://github.com/AndyQdev/abasto.git && cd abasto`
4. Abre Claude Code dentro de `abasto` y pega el prompt de «Retomar».

## Si comparten la cuenta de Claude

Los dos gastan del mismo cupo. Si se acaba, que Jhoel use su propia cuenta: todo lo de arriba sigue funcionando porque vive en el repo.
