# Prompt para el Claude de Jhoel

## Antes (5 minutos, a mano)

1. Instala Node 22+, Docker Desktop, git y uv. Para Campo: Android Studio con un emulador, o el teléfono con depuración USB.
2. `corepack enable && corepack prepare pnpm@12.3.4 --activate`
3. Acepta la invitación al repo en GitHub y clónalo: `git clone <url-del-repo> abasto && cd abasto`
4. Abre Claude Code dentro de la carpeta `abasto` y pega lo de abajo.

## El prompt

```text
Soy Jhoel. Trabajo con Andrés en Abasto, el segundo parcial de Ingeniería de Software II (ICONIX), que se entrega el 3/11/2026.
Este repo ya tiene la base de todo el sistema funcionando y con pruebas. Háblame en español con tuteo.

1. Lee CLAUDE.md, README.md, docs/arquitectura.md, docs/equipo/andres.md y docs/equipo/jhoel.md. Después lee el CLAUDE.md de cada carpeta que es mía: services/catalogo, services/asistente, ml, apps/panel-shell, apps/panel-gestion, apps/panel-inteligencia y apps/campo.
2. Pon el entorno en marcha y no sigas hasta que esté en verde:
   - pnpm verificar (si falta algo, dime cómo instalarlo en mi máquina)
   - pnpm install
   - pnpm todo (la primera vez tarda porque compila los cinco servicios)
   - pnpm e2e (tienen que pasar las 3 pruebas)
   - pnpm test, pnpm test:catalogo y pnpm test:ml
   Si algo falla, diagnostica la causa y arréglala. Si el arreglo toca una carpeta de Andrés, no la cambies: escríbelo en docs/equipo/jhoel.md, en «Necesito del otro».
3. Abre en el navegador http://localhost:5170 (Panel) y http://localhost:5173 (Mercado) con lospozos@abasto.bo / abasto123 para que vea que anda.
4. Resúmeme en 10 líneas qué hay en mis carpetas, qué está hecho y qué está «en construcción».
5. Propón mis primeras tareas en este orden y espera a que elija una:
   a. Catálogo: consumir catalogo.reservar_stock y catalogo.liberar_stock (cola catalogo.comandos) y publicar stock.reservado (con precioUnitarioCentavos por línea), stock.rechazado y stock.liberado, como dice contracts/asyncapi.yaml. La reserva es una sola actualización condicional en Mongo (stock >= cantidad con $inc). Lo necesita Andrés para la saga.
   b. Gestión: la vista Clientes (solicitudes, aprobar con lista NUEVOS/FRECUENTES/VIP y límite de crédito) siguiendo la maqueta docs/uix-mockup/Abasto v1.html.
   c. Gestión: Productos completo (alta con escalas, editar, stock) según la misma maqueta.

Reglas:
- Trabajo en ramas jhoel/<tema> y abro PR a main. Nunca push directo a main.
- Toda funcionalidad nueva lleva su prueba. Un bug se arregla escribiendo primero la prueba que lo reproduce.
- No toco carpetas de Andrés (mira .github/CODEOWNERS). Si cambio algo en contracts/, lo escribo antes en docs/equipo/jhoel.md.
- Al empezar el día uso /empezar y al terminar /cerrar.
```

## Si comparten la cuenta de Claude

Los dos gastan del mismo cupo. Si se acaba, que Jhoel use su propia cuenta: todo lo de arriba sigue funcionando porque vive en el repo.
