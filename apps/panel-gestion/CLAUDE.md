# Gestión · Angular 21 zoneless · dueño: Jhoel (Pedidos y Cuentas por cobrar: Andrés)

Microfrontend del Panel (puerto 5171), publicado como `<abasto-gestion ruta="...">` con @angular/elements y Shadow DOM.

- No tiene router propio: la ruta llega como atributo desde el Shell y la sesión como propiedad `sesion`.
- Todo dato viene por GraphQL federado (`graphql.ts`, contra el Router). Una pantalla pide exactamente los campos que muestra.
- Las vistas están en `src/app/vistas/`. Las que faltan usan `en-construccion` con su fase y se reemplazan siguiendo la maqueta `docs/uix-mockup/Abasto v1.html`.
- Estilos con los tokens de `packages/ui` (`estilos.ts`). Las cantidades siempre van con unidad (`cantidadConUnidad`).

Probar: `pnpm --filter @abasto/panel-gestion test`.
