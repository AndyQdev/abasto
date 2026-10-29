---
name: empezar
description: Arranca una sesión de trabajo en Abasto. Úsala al empezar el día o al retomar una tarea.
---

1. Trae lo último de main, que es donde trabajamos los dos (sin ramas): `git switch main && git pull --rebase origin main`. Si tienes cambios sin commit, haz commit primero. Si el rebase choca, junta los dos cambios a mano sin perder nada del otro (reglas en «Git en main» de `CLAUDE.md`). Si alguien cambió `pnpm-lock.yaml`, corre `pnpm install`.
2. Lee `docs/equipo/*.md` y resume en tres líneas qué hizo el otro desde la última vez (`git log --since=<última vez> --oneline` ayuda). Si cambió algo en `contracts/`, dilo primero.
3. Si la infraestructura no está arriba, `pnpm todo`. Si alguien cambió un schema GraphQL, `pnpm supergrafo` y `docker compose restart router`.
4. Mira mis tarjetas en Trello (https://trello.com/b/ABo8gFFG/abasto). Si no tienes acceso a Trello, pregúntame en qué tarea sigo.
5. Propón la siguiente tarea según la fase vigente del plan y la maqueta que le corresponde (`docs/uix-mockup/README.md`). Espera mi confirmación antes de escribir código.
