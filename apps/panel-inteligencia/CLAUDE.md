# Inteligencia · Vue · dueño: Jhoel

Microfrontend del Panel (puerto 5172), publicado como `<abasto-inteligencia>`: Reportes (preguntas en lenguaje natural y exportar a Excel) y Agentes.

- **Reportes es un chat** (`componentes/Reportes.vue`): a la izquierda la conversación, a la derecha la mesa de trabajo con una pestaña por reporte (`MesaDeReporte.vue`). La plantilla de cada reporte sale de la forma de la respuesta (`reportes/conversacion.ts`, `plantillaDe`). La conversación vive en `sessionStorage` mientras dura la sesión; lo guardado para ver sin señal sigue en `sin-senal/`.
- **Voz en vivo** (`voz/`): `escucha.ts` junta el audio con un AudioWorklet y detecta el silencio; `usar-voz.ts` transcribe con Whisper mientras la persona habla y entrega la pregunta al callarse. En equipos lentos solo transcribe en las pausas.

- Habla con el Asistente por REST (`contracts/openapi/asistente.yaml`) con el token que le pasa el Shell (`sesion.ts`).
- El build genera `remoteEntry.js`, que es lo que carga el Shell.

Probar: `pnpm --filter @abasto/panel-inteligencia test`.
