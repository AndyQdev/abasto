# Panel Shell · React · dueño: Andrés (desde el reparto del 29/10)

El marco del Panel Mayorista (puerto 5170): login, header, menú, buscador, alertas y la carga de los microfrontends. Maqueta: versión 7 «Halo» (`docs/uix-mockup/image1-3.png` y `docs/ABASTO_V7_Guia_Visual_Claude_Code.md`).

- **Marco «Halo» (02/11):** `Marco.tsx` + `halo.css`. Header verde bosque con la curva de abajo (`.halo-abrazo`, un SVG) que abraza al menú blanco flotante; la sección activa es una pestaña lima levantada. Inicio, Productos, Pedidos, Compras y Clientes van en el menú; el resto, bajo «Más» (`navegacion.ts`, `principal`).
- **Dock derecho:** Alertas, Agentes, Reportes, Tableros y Ayuda. Se pliega con la lengüeta lima (se recuerda en `localStorage`; abajo de 1100 px arranca plegado). Nada queda debajo: el contenido deja `--hueco-dock` a la derecha.
- **Alertas** (`alertas.ts`): pedidos por confirmar (el más viejo arriba) y tiendas que piden ser clientes. Se refrescan cada minuto y después de cada `abasto:aviso`. Las muestran la campana y el dock.
- **Buscador del header:** un código de pedido va a `pedidos?q=…` y lo demás a `productos?q=…` (`destinoDeBusqueda`). Además manda `abasto:buscar` para la vista que ya está abierta.
- Los tokens del Panel (lima, bosque, ámbar, Plus Jakarta Sans) se pisan en `halo.css`, no en `packages/ui`: así el Superadmin no cambia.
- **Escala (02/11):** `escala.ts` le pone `zoom` a la raíz para que en escritorio el Panel siempre se vea como en una pantalla de 1680 px (en una laptop de 1260 px de ancho útil queda en 0,75, lo que antes había que hacer con el zoom del navegador). En el teléfono (860 px o menos) no se toca. Por eso no hay cortes intermedios de escritorio ni `vw`: los `@media` de Gestión son solo de teléfono (las container queries miden mal con zoom).
- **Service worker viejo (02/11):** `pnpm pwa` usa el mismo puerto 5170. Si el navegador abrió alguna vez el build, su service worker seguía sirviendo el Shell viejo (menú lateral) aunque corriera `pnpm dev:panel`. En desarrollo, `/sw.js` es uno que se borra solo (plugin en `vite.config.ts`) y `main.tsx` desregistra lo que quede: basta con abrir la página.

- No tiene pantallas de negocio: según la ruta monta `<abasto-gestion>` (Angular, 5171) o `<abasto-inteligencia>` (Vue, 5172) como Web Components.
- `remotos.ts` dice dónde está cada remoto; `Microfrontend.tsx` carga su script y le pasa la sesión (`token()`, usuario y URLs).
- **Registro de mayoristas (CU-01, 31/10):** `/registro` es público (no pide sesión: `main.tsx` lo atiende antes de `asegurar()`). Llama a `registrarMayorista` de Catálogo, que crea la cuenta en Keycloak y la empresa PENDIENTE. La lógica está en `datos-de-registro.ts` (no `registro.ts`: en Windows choca con `Registro.tsx`).
- Arriba del contenido, el aviso «Tu empresa está en revisión» o el motivo del rechazo (`verificacion.ts`, consulta `miOrganizacion`).
- Cambiar de módulo no recarga la página (lo prueba `e2e/pruebas/panel.spec.ts`). El contrato entre el Shell y los remotos está en `contracts/microfrontends.md`.

Correr: `pnpm dev:panel` (levanta los tres). Probar: `pnpm --filter @abasto/panel-shell test`.
