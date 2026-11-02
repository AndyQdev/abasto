# Panel Shell · React · dueño: Andrés (desde el reparto del 29/10)

El marco del Panel Mayorista (puerto 5170): login, menú lateral, buscador y la carga de los microfrontends. Maqueta: `docs/uix-mockup/Abasto v1.html`.

- No tiene pantallas de negocio: según la ruta monta `<abasto-gestion>` (Angular, 5171) o `<abasto-inteligencia>` (Vue, 5172) como Web Components.
- `remotos.ts` dice dónde está cada remoto; `Microfrontend.tsx` carga su script y le pasa la sesión (`token()`, usuario y URLs).
- **Registro de mayoristas (CU-01, 31/10):** `/registro` es público (no pide sesión: `main.tsx` lo atiende antes de `asegurar()`). Llama a `registrarMayorista` de Catálogo, que crea la cuenta en Keycloak y la empresa PENDIENTE. La lógica está en `datos-de-registro.ts` (no `registro.ts`: en Windows choca con `Registro.tsx`).
- Arriba del contenido, el aviso «Tu empresa está en revisión» o el motivo del rechazo (`verificacion.ts`, consulta `miOrganizacion`).
- Cambiar de módulo no recarga la página (lo prueba `e2e/pruebas/panel.spec.ts`). El contrato entre el Shell y los remotos está en `contracts/microfrontends.md`.

Correr: `pnpm dev:panel` (levanta los tres). Probar: `pnpm --filter @abasto/panel-shell test`.
