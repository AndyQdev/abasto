# Contrato entre el Shell del Panel y sus microfrontends

El Panel Mayorista es un Shell en React (`apps/panel-shell`) que carga dos aplicaciones hechas con otros frameworks.
Cada una se despliega por separado y el Shell no sabe qué hay adentro: solo conoce una etiqueta HTML.

| Remoto | Framework | Etiqueta | Script en desarrollo | Rutas que atiende |
|---|---|---|---|---|
| Gestión | Angular | `<abasto-gestion>` | `http://localhost:5171/main.js` | inicio, productos, pedidos, clientes, cuentas, conecta |
| Inteligencia | Vue | `<abasto-inteligencia>` | `http://localhost:5172/src/remoto.ts` | agentes, reportes |

Los scripts salen de `apps/panel-shell/public/remotos.json`. En producción apuntan a los `main.js` / `remoteEntry.js` publicados.

## Lo que el Shell le da a cada remoto

- **Atributo `ruta`** (texto): la pantalla que debe mostrar. El remoto no tiene router propio.
- **Propiedad `sesion`** (objeto, no atributo, porque lleva una función):

```ts
interface SesionDelShell {
  token: () => Promise<string>;          // siempre pedir el token fresco, no guardarlo
  usuario: { id: string; nombre: string; orgId: string; orgNombre: string; roles: string[] };
  urls: { router: string; asistente: string; conecta: string };
}
```

## Lo que un remoto le puede pedir al Shell

Eventos `CustomEvent` con `bubbles: true` y `composed: true` (para que atraviesen el Shadow DOM):

| Evento | `detail` | Qué hace el Shell |
|---|---|---|
| `abasto:navegar` | `{ ruta: string }` | Cambia de pantalla (y de remoto si hace falta) |
| `abasto:aviso` | `{ texto: string }` | Muestra un aviso abajo por 4 segundos |

## Lo que el Shell le avisa a los remotos (agregado el 02/11)

| Evento en `document` | `detail` | Para qué |
|---|---|---|
| `abasto:buscar` | `{ texto: string }` | El buscador del header. Si la vista ya estaba abierta, filtra con ese texto. |

Además, al navegar desde el buscador el Shell deja la búsqueda en la URL (`/productos?q=arroz`). El atributo `ruta` sigue llegando sin la búsqueda.

## Reglas

- Cada remoto vive en su **Shadow DOM**: sus estilos no se escapan y los del Shell no lo pisan.
- Los colores, radios y fuentes son **variables CSS del sistema UIX** que define el Shell (`packages/ui/tokens.css`).
  Las variables atraviesan el Shadow DOM; las clases no. Por eso cada remoto trae sus propias clases usando `var(--…)`.
- Ningún remoto importa código de otro. Si dos necesitan lo mismo, va a `packages/` o se repite.
- Cambiar este contrato es un PR aparte que aprueba la otra persona.
