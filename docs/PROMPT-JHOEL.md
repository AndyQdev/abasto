# Prompt para el Claude de Jhoel

Actualizado el 29/10. Si ya tienes el repo, pega en Claude Code el prompt de «Retomar». Si es una máquina nueva, haz primero «Desde cero».

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
