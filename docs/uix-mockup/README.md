# Maquetas

Prototipos navegables hechos con Claude Design. Se abren en el navegador. Cada pantalla nueva se construye mirando su maqueta.

| Archivo | Interfaz | Módulos |
|---|---|---|
| `Abasto v1.html` | **Panel Mayorista** (`apps/panel-*`) | Inicio, Productos, Pedidos, Clientes, Cuentas por cobrar, Agentes, Reportes, Conecta |
| `Abasto v1 (1).html` | **Mercado** (`apps/mercado`), la app de las tiendas. No es Campo | Inicio, Buscar (también por foto), Carrito, Pedidos con el seguimiento de la saga, Cuenta, Integraciones |
| `Abasto v1 – Abasto Backoffice · Superadmin · prototipo navegable.html` | **Superadmin** (`apps/superadmin`) | Inicio, Mayoristas (verificaciones), Tiendas, Usuarios y roles, Reclamos, Reportes, Integraciones, Sistema, Auditoría |

Campo (Expo) no tiene maqueta propia: sigue el estilo de Mercado en pantalla de teléfono.

Los colores, tipografías y radios ya están en `packages/ui/tokens.css`. Úsalos en vez de copiar valores de las maquetas.
