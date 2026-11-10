<script setup lang="ts">
import { computed, ref } from 'vue';
import { bloquesDe, horaCorta, type Reporte } from '../reportes/conversacion';
import BloqueDeReporte from './BloqueDeReporte.vue';
import Icono from './Icono.vue';

/**
 * Un reporte armado en la mesa de trabajo: una vista de 1 a 5 bloques (KPIs, línea, barras, dona, tabla) que eligió
 * el Analista y llenó con sus consultas, como las plantillas de Fifi en glow. Arriba, lo que el Analista leyó en los
 * datos. Los reportes de antes del 10/11 no traen bloques y se ven como uno solo (`bloquesDe`).
 */
const props = defineProps<{ reporte: Reporte; sinSenal: boolean; exportando: boolean }>();
defineEmits<{ excel: [reporte: Reporte]; repetir: [pregunta: string] }>();

const verSql = ref(false);
const bloques = computed(() => bloquesDe(props.reporte));
const lectura = computed(() => props.reporte.lectura ?? null);
const filas = computed(() => bloques.value.reduce((s, b) => s + b.filas.length, 0));
const sql = computed(() => bloques.value.map((b) => (bloques.value.length > 1 ? `-- ${b.titulo}\n${b.sql}` : b.sql)).join('\n\n'));
</script>

<template>
  <article class="rp-reporte" :aria-label="reporte.pregunta">
    <header class="rp-reporte-cabecera">
      <div>
        <h2>{{ reporte.pregunta }}</h2>
        <p class="rp-explicacion">{{ reporte.explicacion }}</p>
        <span class="gris">
          <template v-if="bloques.length > 1">{{ bloques.length }} bloques · </template>
          {{ filas }} {{ filas === 1 ? 'fila' : 'filas' }} · {{ reporte.modelo }} ·
          <template v-if="reporte.deGuardado">guardado el {{ reporte.deGuardado }}</template>
          <template v-else>{{ horaCorta(reporte.hora) }}</template>
        </span>
      </div>
      <div class="rp-reporte-acciones">
        <button class="rp-boton-chico" :aria-pressed="verSql" @click="verSql = !verSql">
          <Icono nombre="codigo" :tamano="15" />{{ verSql ? 'Ocultar SQL' : 'Ver SQL' }}
        </button>
        <button v-if="reporte.deGuardado" class="rp-boton-chico" :disabled="sinSenal" @click="$emit('repetir', reporte.pregunta)">
          <Icono nombre="recargar" :tamano="15" />Actualizar
        </button>
        <button
          class="boton-primario rp-excel"
          :disabled="sinSenal || exportando || !filas"
          :title="sinSenal ? 'Exportar a Excel necesita señal' : bloques.length > 1 ? 'Una hoja por bloque' : undefined"
          @click="$emit('excel', reporte)"
        >
          <Icono nombre="descargar" :tamano="15" />{{ exportando ? 'Preparando…' : 'Exportar a Excel' }}
        </button>
      </div>
    </header>

    <pre v-if="verSql" class="rp-sql">{{ sql }}</pre>

    <section v-if="lectura" class="rp-lectura" aria-label="Lo que leyó el Analista">
      <div v-if="lectura.hallazgos.length">
        <h3><Icono nombre="chispa" :tamano="15" />Lo que veo</h3>
        <ul>
          <li v-for="h in lectura.hallazgos" :key="h">{{ h }}</li>
        </ul>
      </div>
      <div v-if="lectura.recomendaciones.length" class="rp-recomendaciones">
        <h3><Icono nombre="visto" :tamano="15" />Te recomiendo</h3>
        <ol>
          <li v-for="r in lectura.recomendaciones" :key="r">{{ r }}</li>
        </ol>
      </div>
    </section>

    <div class="rp-bloques">
      <BloqueDeReporte v-for="(b, i) in bloques" :key="`${reporte.id}-${i}`" :bloque="b" :principal="i === 0" />
    </div>

    <p v-if="bloques.some((b) => b.truncado)" class="gris rp-recortado">
      {{ reporte.deGuardado ? 'En este equipo se guardaron las primeras 200 filas.' : 'Se muestran las primeras 1.000 filas.' }}
    </p>
  </article>
</template>

<style>
.rp-bloques { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 1rem; align-items: start; }
.rp-bloque { min-width: 0; padding: 1rem 1.1rem; border-radius: 18px; border: 1px solid hsl(var(--borde)); background: hsl(var(--superficie)); animation: rp-entrar 0.3s ease-out both; }
.rp-bloque.ancho { grid-column: 1 / -1; }
.rp-bloque:nth-child(2) { animation-delay: 0.05s; }
.rp-bloque:nth-child(3) { animation-delay: 0.1s; }
.rp-bloque:nth-child(4) { animation-delay: 0.15s; }
.rp-bloque:nth-child(5) { animation-delay: 0.2s; }
.rp-bloque-cabecera { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.75rem; }
.rp-bloque-cabecera h3 { margin: 0; font-family: var(--fuente-titulo); font-size: 0.95rem; letter-spacing: -0.01em; }
.rp-bloque-acciones { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.rp-ver-como { display: inline-flex; padding: 2px; border-radius: 999px; background: hsl(var(--tenue)); border: 1px solid hsl(var(--borde)); }
.rp-ver-como button { display: inline-flex; align-items: center; gap: 0.25rem; height: 26px; padding: 0 0.6rem; font: inherit; font-size: 0.75rem; font-weight: 600; border: 0; border-radius: 999px; background: none; color: hsl(var(--texto-2)); cursor: pointer; }
.rp-ver-como button[aria-pressed='true'] { background: hsl(var(--superficie)); color: hsl(var(--texto)); box-shadow: 0 1px 2px hsl(var(--tinta) / 0.12); }
.rp-ver-como button span { display: none; }
.rp-ver-como button[aria-pressed='true'] span { display: inline; }
.rp-bloque-aviso { margin: -0.4rem 0 0.75rem; font-size: 0.75rem; }
.rp-bloque .rp-numeros { margin-bottom: 0; }
.rp-bloque .rp-lienzo { margin-bottom: 0; }
.rp-bloque .rp-tabla { margin-top: 0.75rem; max-height: 360px; overflow: auto; }
.rp-bloque-tabla .rp-tabla { margin-top: 0; }
.rp-variacion { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; font-size: 0.75rem; opacity: 0.85; }
.rp-variacion b { font-variant-numeric: tabular-nums; }
.rp-variacion.sube b { color: hsl(var(--exito-suave-texto)); }
.rp-variacion.baja b { color: hsl(var(--error-suave-texto)); }
.rp-numero.principal .rp-variacion.sube b { color: hsl(var(--primary)); }
.rp-numero.principal .rp-variacion.baja b { color: #ffb4a8; }

.rp-lectura { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 1rem; margin-bottom: 1rem; padding: 1rem 1.2rem; border-radius: 18px; background: hsl(var(--tenue)); border: 1px solid hsl(var(--borde)); }
.rp-lectura h3 { display: flex; align-items: center; gap: 0.4rem; margin: 0 0 0.5rem; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: hsl(var(--texto-2)); }
.rp-lectura ul, .rp-lectura ol { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.4rem; font-size: 0.875rem; line-height: 1.45; }
.rp-recomendaciones { padding-left: 1rem; border-left: 3px solid hsl(var(--primary)); }
</style>
