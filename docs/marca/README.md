# La marca de Abasto

![Logo de Abasto](abasto-logo.png)

**El símbolo (10/11):** una «A» lima cuyo travesaño es un paquete ámbar. Abasto lleva la mercadería a la tienda: la «A» es el techo del puesto y el paquete, lo que llega. Al lado va la palabra **abasto**, en minúsculas.

## Archivos

| Archivo | Para qué |
|---|---|
| `abasto-logo.png` | Logo completo sobre fondos claros (documentos, presentaciones) |
| `abasto-logo-blanco.png` | Logo completo sobre fondos oscuros o fotos |
| `icono.svg` · `icono-1024.png` | El ícono: el símbolo sobre el cuadrado redondeado verde bosque |
| `simbolo-lima.svg` | El símbolo sobre verde bosque u oscuro |
| `simbolo-bosque.svg` | El símbolo sobre blanco o el fondo claro |
| `simbolo-blanco.svg` | En una sola tinta (como las notificaciones de Android) |

**De dónde sale todo:**
- La geometría y los colores están en `packages/ui/marca.ts`, la fuente única.
- `pnpm marca` (`scripts/marca.ts`) genera estos archivos, los íconos de la app (`apps/app/assets`: ícono, adaptativo, monocromo, notificación, pantalla de inicio y favicon) y los de las webs (favicons y PWA del Panel).
- **No se editan a mano:** se cambia `marca.ts` y se vuelve a correr `pnpm marca`. Para la app, además, `npx expo prebuild --platform android` y recompilar.

**En el código:**
- App: `Logo` y `Simbolo` en `apps/app/src/Marca.tsx`. Están en la cabecera del Inicio y en la bienvenida.
- Panel: `Simbolo` en `apps/panel-shell/src/iconos.tsx`, en el header y en el registro.
- Superadmin: `apps/superadmin/src/Simbolo.tsx`, en el lateral.

## Colores

| | Hex | Uso |
|---|---|---|
| Lima | `#C9F45A` | La «A» sobre fondos oscuros; acentos |
| Verde bosque | `#182D25` | Fondo del ícono; la «A» y la palabra sobre fondos claros |
| Ámbar | `#FFB454` | El paquete. Siempre ámbar, en todas las versiones a color |
| Fondo | `#F2F7EB` | Fondo claro de la app |

**Tipografía:** Plus Jakarta Sans ExtraBold (800) para la palabra, con espaciado de −0,035 em. La misma familia de la app y del Panel.

## Reglas

- **Aire alrededor:** deja libre al menos la mitad del ancho del paquete por cada lado.
- **Tamaño mínimo:** el símbolo, 16 px; el logo completo, 24 px de alto. Más chico, usa solo el símbolo.
- **Sobre fondos medios** (fotos, el lima), usa el ícono completo (con su cuadrado verde bosque), no el símbolo suelto.
- **No** cambies los colores del paquete ni de la «A», **no** la estires, **no** le pongas sombras ni contornos, y **no** escribas «ABASTO» en mayúsculas al lado del símbolo.
- Las ilustraciones 3D de la app (la moto, la tienda) traen un carrito con «ABASTO» pintado. Son parte de la escena, no el logo: se dejan así hasta que se regeneren.
