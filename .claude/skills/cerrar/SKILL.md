---
name: cerrar
description: Cierra la sesión de trabajo en Abasto: prueba lo que cambió, deja el estado al día y sube todo a main.
---

1. Corre las pruebas de las carpetas que cambiaste (`pnpm --filter <paquete> test`, `pnpm test:pedidos`, `pnpm test:catalogo`, `pnpm test:ml`, `pnpm arquitectura`). Si tocaste algo que ve el usuario, también `pnpm e2e`. Si algo falla, dímelo y no sigas.
2. Reescribe tu archivo en `docs/equipo/` (`andres.md` o `jhoel.md`, según `git config user.name`) con: Estoy en, Terminé, Cambié en contratos, Necesito del otro y Sigue. Máximo 20 líneas, con fecha.
3. Commit con Conventional Commits en `main`. Si tocaste `contracts/` o un schema GraphQL, dilo en el mensaje del commit.
4. `git pull --rebase origin main`. Si choca, junta los dos cambios a mano sin perder nada del otro (reglas en «Git en main» de `CLAUDE.md`). Después del rebase vuelve a correr las pruebas de lo que cambió y haz `git push origin main`. Nunca `--force`.
5. Dime qué tarjeta de Trello mover y a qué lista.
