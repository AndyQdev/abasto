---
name: cerrar
description: Cierra la sesión de trabajo en Abasto: prueba lo que cambió, deja el estado al día y abre el PR.
---

1. Corre las pruebas de las carpetas que cambiaste (`pnpm --filter <paquete> test`, `pnpm test:pedidos`, `pnpm test:catalogo`, `pnpm test:ml`, `pnpm arquitectura`). Si tocaste algo que ve el usuario, también `pnpm e2e`. Si algo falla, dímelo y no sigas.
2. Reescribe tu archivo en `docs/equipo/` (`andres.md` o `jhoel.md`, según `git config user.name`) con: Estoy en, Terminé, Cambié en contratos, Necesito del otro y Sigue. Máximo 20 líneas, con fecha y rama.
3. Si tocaste `contracts/` o un schema GraphQL, ponlo en la primera línea del PR.
4. Commit con Conventional Commits y push de la rama. Abre el PR a main con `gh pr create` usando la plantilla. Nunca push directo a main.
5. Dime qué tarjeta de Trello mover y a qué lista.
