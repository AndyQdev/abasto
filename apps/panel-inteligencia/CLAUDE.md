# Inteligencia · Vue · dueño: Jhoel

Microfrontend del Panel (puerto 5172), publicado como `<abasto-inteligencia>`: Reportes (preguntas en lenguaje natural y exportar a Excel) y Agentes.

- Habla con el Asistente por REST (`contracts/openapi/asistente.yaml`) con el token que le pasa el Shell (`sesion.ts`).
- El build genera `remoteEntry.js`, que es lo que carga el Shell.

Probar: `pnpm --filter @abasto/panel-inteligencia test`.
