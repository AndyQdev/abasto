# Mercado · React PWA · dueño: Andrés

La app de las tiendas (puerto 5173): buscar, carrito, pedidos, cuenta e integraciones. Maqueta: `docs/uix-mockup/Abasto v1 (1).html`.

- Red privada: una tienda ve precios solo de los mayoristas que la aprobaron; en el resto aparece «Pedir ser cliente». Un distribuidor que también compra no ve sus propios productos.
- Todo va por GraphQL al Router (`servicios.ts`). Sesión con `packages/sesion` (cliente `abasto-mercado`).
- El carrito agrupa por mayorista (`carrito.ts`): un pedido por mayorista.

Probar: `pnpm --filter @abasto/mercado test`.
