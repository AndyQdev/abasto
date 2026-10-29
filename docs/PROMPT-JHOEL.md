# Prompt para el Claude de Jhoel

> **29/10: cambió el flujo.** Lee primero el aviso de `docs/equipo/andres.md`. Ya no hay web de Mercado ni app Campo: hay una sola app de clientes (`apps/app`, Expo) y la gestión se hace en el Panel web.

## Antes (10 minutos, a mano)

1. Instala Node 22+, Docker Desktop, git y uv. Para Campo: Android Studio (SDK y adb), JDK 17 y el teléfono con depuración USB.
2. `corepack enable && corepack prepare pnpm@12.3.4 --activate`
3. Acepta la invitación al repo que te llega por correo de GitHub y clónalo:
   `git clone https://github.com/AndyQdev/abasto.git && cd abasto`
4. Abre Claude Code dentro de la carpeta `abasto` y pega lo de abajo.

Las tareas están en Trello: https://trello.com/b/ABo8gFFG/abasto. Cada tarjeta trae la descripción, la maqueta, las subtareas y las pruebas. Muévelas tú: Tareas → En proceso → En prueba (y a Hecho cuando el PR entra a main).

## El prompt

```text
Soy Jhoel. Trabajo con Andrés en Abasto, el segundo parcial de Ingeniería de Software II (ICONIX, Grupo #13), que se entrega el 3/11/2026.
Este repo ya tiene la base de todo el sistema funcionando y con pruebas. Háblame en español con tuteo.
Las tareas están en Trello (https://trello.com/b/ABo8gFFG/abasto). Cuando empiece una, te pego el texto de su tarjeta.

1. Lee CLAUDE.md, README.md, docs/arquitectura.md, docs/equipo/andres.md, docs/equipo/jhoel.md y contracts/asyncapi.yaml.
   Después lee el CLAUDE.md de cada carpeta que es mía: services/catalogo, services/asistente, ml, apps/panel-shell, apps/panel-gestion, apps/panel-inteligencia y apps/campo.
2. Pon el entorno en marcha y no sigas hasta que esté en verde:
   - pnpm verificar (si falta algo, dime cómo instalarlo en mi máquina)
   - pnpm install
   - pnpm todo (la primera vez tarda porque compila los cinco servicios)
   - pnpm e2e (tienen que pasar las 3 pruebas)
   - pnpm test, pnpm test:catalogo y pnpm test:ml
   Si algo falla, diagnostica la causa y arréglala. Si el arreglo toca una carpeta de Andrés, no la cambies: escríbelo en docs/equipo/jhoel.md, en «Necesito del otro».
3. Abre en el navegador http://localhost:5170 (Panel) y http://localhost:5173 (Mercado) con lospozos@abasto.bo / abasto123 para que vea que anda.
4. Resúmeme en 10 líneas qué hay en mis carpetas, qué está hecho y qué está «en construcción».
5. Revisa contracts/asyncapi.yaml del lado de Catálogo (catalogo.reservar_stock, catalogo.liberar_stock, stock.reservado con precioUnitarioCentavos por línea, stock.rechazado y stock.liberado) y dime si algo no te cierra antes de programarlo.
6. Mis tareas, en este orden (son tarjetas de Trello). Propón cómo encarar la primera y espera a que te diga que sí:
   a. Campo: build de desarrollo de Expo con un TFLite de ejemplo en mi Android. Es el mayor riesgo: hay que saber ya si TFLite y ML Kit corren. Expo Go no sirve; dentro de apps/campo se usa npm.
   b. Catálogo en la saga: consumir catalogo.reservar_stock y catalogo.liberar_stock (cola catalogo.comandos) y publicar stock.reservado, stock.rechazado y stock.liberado. La reserva es una sola actualización condicional en Mongo (stock >= cantidad con $inc), con outbox e inbox. Andrés lo necesita para el 25: sin esto los pedidos quedan en Bs 0.
   c. Gestión · Clientes (CU-04): solicitudes, aprobar con lista NUEVOS/FRECUENTES/VIP y límite de crédito, según docs/uix-mockup/Abasto v1.html. El límite vive en Cobros: propón el evento relacion.aprobada y anótalo en docs/equipo/jhoel.md antes de tocar contracts/.
   d. Gestión · Productos completo (CU-02): alta con escalas, editar y stock, según la misma maqueta.
   e. Catálogo: verificación de mayoristas (CU-01, servicio) y la semilla de la demo (3 mayoristas, 2 tiendas, 40 productos).

Reglas:
- Trabajo en ramas jhoel/<tema> y abro PR a main. Nunca push directo a main.
- Toda funcionalidad nueva lleva su prueba. Un bug se arregla escribiendo primero la prueba que lo reproduce.
- No toco carpetas de Andrés (mira .github/CODEOWNERS). Si cambio algo en contracts/, lo escribo antes en docs/equipo/jhoel.md.
- Las pantallas salen de las maquetas de docs/uix-mockup/ y usan los tokens de packages/ui.
- Al empezar el día uso /empezar y al terminar /cerrar.
```

## Si comparten la cuenta de Claude

Los dos gastan del mismo cupo. Si se acaba, que Jhoel use su propia cuenta: todo lo de arriba sigue funcionando porque vive en el repo.
