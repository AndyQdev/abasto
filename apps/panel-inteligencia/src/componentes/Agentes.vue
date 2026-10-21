<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { llamarAsistente, type SesionDelShell } from '../sesion';

const props = defineProps<{ sesion: SesionDelShell }>();

interface Agente {
  id: string;
  nombre: string;
  mision: string;
  habilidades: string[];
  horario: string;
  requiereAprobacion: string[];
}

interface Propuesta {
  id: string;
  agenteId: string;
  titulo: string;
  detalle: string;
  creadaEn: string;
}

const agentes = ref<Agente[]>([]);
const propuestas = ref<Propuesta[]>([]);
const error = ref<string | null>(null);
const ocupado = ref<string | null>(null);

async function cargar() {
  try {
    [agentes.value, propuestas.value] = await Promise.all([
      llamarAsistente<Agente[]>(props.sesion, '/v1/agentes'),
      llamarAsistente<Propuesta[]>(props.sesion, '/v1/agentes/propuestas'),
    ]);
    error.value = null;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function ejecutar(agente: Agente) {
  ocupado.value = agente.id;
  try {
    await llamarAsistente(props.sesion, `/v1/agentes/${agente.id}/ejecutar`, { metodo: 'POST' });
    await cargar();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    ocupado.value = null;
  }
}

async function decidir(propuesta: Propuesta, aprobar: boolean) {
  ocupado.value = propuesta.id;
  try {
    await llamarAsistente(props.sesion, `/v1/agentes/propuestas/${propuesta.id}/decision`, {
      metodo: 'POST',
      cuerpo: { aprobar },
    });
    await cargar();
  } finally {
    ocupado.value = null;
  }
}

const habilidad = (h: string) => h.replace(/_/g, ' ');

onMounted(cargar);
</script>

<template>
  <div class="cabecera">
    <h1 class="titulo-pantalla">Agentes de Abasto</h1>
    <div class="contadores"><div><strong>{{ propuestas.length }}</strong>esperan tu aprobación</div></div>
  </div>

  <p v-if="error" class="falla">{{ error }}</p>

  <div class="grilla">
    <article v-for="a in agentes" :key="a.id" class="carta agente">
      <h3>{{ a.nombre }}</h3>
      <p class="mision"><span class="gris">Misión</span>{{ a.mision }}</p>
      <p class="gris">Habilidades</p>
      <ul><li v-for="h in a.habilidades" :key="h">{{ habilidad(h) }}</li></ul>
      <p class="gris">Corre: {{ a.horario }}</p>
      <button class="boton-secundario" :disabled="ocupado === a.id" @click="ejecutar(a)">Ejecutar ahora</button>
    </article>
  </div>

  <h3>Esperan tu aprobación</h3>
  <div class="carta">
    <p v-if="!propuestas.length" class="vacio">Ningún agente está esperando una decisión.</p>
    <div v-for="p in propuestas" :key="p.id" class="propuesta">
      <div>
        <strong>{{ p.titulo }}</strong>
        <span class="gris">{{ p.detalle }}</span>
      </div>
      <div class="acciones">
        <button class="boton-secundario" :disabled="ocupado === p.id" @click="decidir(p, false)">Rechazar</button>
        <button class="boton-primario" :disabled="ocupado === p.id" @click="decidir(p, true)">Aprobar</button>
      </div>
    </div>
  </div>
</template>

<style>
.grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.agente h3 { margin: 0 0 0.5rem; font-family: var(--fuente-titulo); }
.agente ul { margin: 0.25rem 0 0.75rem; padding-left: 1.1rem; color: hsl(var(--texto-2)); }
.mision .gris { display: block; }
.propuesta { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.75rem 0; border-top: 1px solid hsl(var(--borde)); }
.propuesta:first-of-type { border-top: 0; }
</style>
