# Maquetas

Prototipos navegables hechos con Claude Design. Se abren en el navegador. Cada pantalla nueva se construye mirando su maqueta.

| Archivo | Interfaz | Módulos |
|---|---|---|
| `Abasto v1.html` | **Panel Mayorista** (`apps/panel-*`) | Inicio, Productos, Pedidos, Clientes, Cuentas por cobrar, Agentes, Reportes, Conecta |
| `Abasto v1 (1).html` | **Mercado** (`apps/mercado`), la app de las tiendas. No es Campo | Inicio, Buscar (también por foto), Carrito, Pedidos con el seguimiento de la saga, Cuenta, Integraciones |
| `Abasto v1 – Abasto Backoffice · Superadmin · prototipo navegable.html` | **Superadmin** (`apps/superadmin`) | Inicio, Mayoristas (verificaciones), Tiendas, Usuarios y roles, Reclamos, Reportes, Integraciones, Sistema, Auditoría |

**Panel Mayorista, versión 7 «Halo» (02/11, la vigente):** `image1.png` (Pedidos), `image2.png` (Compras) e `image3.png` (Productos), con su guía en `docs/ABASTO_V7_Guia_Visual_Claude_Code.md`. Manda sobre `Abasto v1.html` en el Panel: header verde bosque con la curva que abraza al menú blanco flotante, dock de accesos a la derecha y tarjetas grandes. Los datos de las imágenes son de ejemplo.

Campo (Expo) no tiene maqueta propia: sigue el estilo de Mercado en pantalla de teléfono.

Los colores, tipografías y radios ya están en `packages/ui/tokens.css`. Úsalos en vez de copiar valores de las maquetas.
