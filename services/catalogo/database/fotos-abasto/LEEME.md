# Fotos del catálogo de Abasto

Una por producto, `<código>.webp` (640 × 640, fondo blanco). `php artisan catalogo:semilla-abasto` las copia al almacén de fotos.

Son productos reales de Bolivia. Las fotos y los precios al público salen de las tiendas en línea de Fidalga y Amarket (Santa Cruz, 30/10/2026). Se usan solo como datos de demostración del proyecto académico. Cuando se cargue el catálogo real, se cambian por fotos propias.

Desde el 02/11 los productos que no tienen foto de tienda (los de presentación de mercado y los del catálogo real por
área: carne, verduras, descartables…) llevan una ilustración 3D generada con `scripts/ilustraciones/generar.mjs`, en el
mismo formato (640 × 640, fondo blanco). Ningún producto queda sin imagen: lo revisa `AbastoVendeTest`.
