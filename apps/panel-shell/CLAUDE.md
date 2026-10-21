# Panel Shell · React · dueño: Jhoel

El marco del Panel Mayorista (puerto 5170): login, menú lateral, buscador y la carga de los microfrontends. Maqueta: `docs/uix-mockup/Abasto v1.html`.

- No tiene pantallas de negocio: según la ruta monta `<abasto-gestion>` (Angular, 5171) o `<abasto-inteligencia>` (Vue, 5172) como Web Components.
- `remotos.ts` dice dónde está cada remoto; `Microfrontend.tsx` carga su script y le pasa la sesión (`token()`, usuario y URLs).
- Cambiar de módulo no recarga la página (lo prueba `e2e/pruebas/panel.spec.ts`). El contrato entre el Shell y los remotos está en `contracts/microfrontends.md`.

Correr: `pnpm dev:panel` (levanta los tres). Probar: `pnpm --filter @abasto/panel-shell test`.
