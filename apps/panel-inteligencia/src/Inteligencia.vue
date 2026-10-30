<script setup lang="ts">
import Agentes from './componentes/Agentes.vue';
import Reportes from './componentes/Reportes.vue';
import Tableros from './componentes/Tableros.vue';
import type { SesionDelShell } from './sesion';

/** Raíz del microfrontend: <abasto-inteligencia ruta="reportes">. La ruta la decide el Shell. */
defineProps<{ ruta?: string; sesion?: SesionDelShell }>();
</script>

<template>
  <p v-if="!sesion" class="vacio">Esperando la sesión del Panel…</p>
  <Agentes v-else-if="ruta === 'agentes'" :sesion="sesion" />
  <Tableros v-else-if="ruta === 'tableros'" :sesion="sesion" />
  <Reportes v-else :sesion="sesion" />
</template>

<style>
/* Base de todas las vistas: las variables del sistema UIX llegan del Shell a través del Shadow DOM */
:host { display: block; font-family: var(--fuente-sans); color: hsl(var(--texto)); font-size: 0.8125rem; }
.cabecera { display: flex; align-items: flex-end; justify-content: space-between; margin: 0.5rem 0 1.25rem; }
.titulo-pantalla { font-family: var(--fuente-titulo); font-size: 2.125rem; font-weight: 700; letter-spacing: -0.04em; text-transform: uppercase; line-height: 1; margin: 0; }
.contadores { color: hsl(var(--texto-2)); }
.contadores strong { display: block; font-family: var(--fuente-titulo); font-size: 1.5rem; color: hsl(var(--texto)); }
.carta { background: hsl(var(--superficie)); border: 1px solid hsl(var(--borde)); border-radius: var(--radio-xl); box-shadow: var(--sombra-carta); padding: 1.25rem; }
.entrada { height: var(--alto-control); padding: 0 0.875rem; border-radius: var(--radio); border: 1px solid hsl(var(--borde)); background: hsl(var(--superficie)); font: inherit; }
.boton-primario, .boton-secundario { height: var(--alto-control); padding: 0 1rem; font: inherit; font-weight: 600; cursor: pointer; }
.boton-primario { border: 0; border-radius: var(--radio-md); background: hsl(var(--primary)); color: hsl(var(--primary-texto)); box-shadow: var(--sombra-marca); }
.boton-secundario { border-radius: var(--radio); background: hsl(var(--superficie)); border: 1px solid hsl(var(--borde)); color: hsl(var(--texto-2)); }
button:disabled { opacity: 0.55; cursor: default; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 0.625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: hsl(var(--texto-3)); background: hsl(var(--cabecera-tabla)); padding: 0.6rem 0.9rem; }
td { padding: 0.7rem 0.9rem; border-top: 1px solid hsl(var(--borde)); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.gris { color: hsl(var(--texto-3)); font-size: 0.6875rem; display: block; }
.acciones { display: flex; gap: 0.5rem; }
.vacio { padding: 2rem; text-align: center; color: hsl(var(--texto-3)); }
.falla { padding: 1rem; border-radius: var(--radio); background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); }
</style>
