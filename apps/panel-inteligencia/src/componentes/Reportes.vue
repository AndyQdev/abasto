<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { armarSerie } from '../graficos/serie';
import { encabezado, formatearCelda, llamarAsistente, type SesionDelShell } from '../sesion';
import {
  buscarGuardado,
  cuandoSeGuardo,
  encolarPregunta,
  esFaltaDeRed,
  guardarReporte,
  preguntasPendientes,
  quitarPendiente,
  reportesGuardados,
  type ReporteGuardado,
} from '../sin-senal/reportes-sin-senal';
import { usarVoz, type DependenciasDeVoz } from '../voz/usar-voz';
import Grafico from './Grafico.vue';

/** `voz` solo se pasa en las pruebas: reemplaza el micrófono y el modelo de Whisper. */
const props = defineProps<{ sesion: SesionDelShell; voz?: DependenciasDeVoz }>();

interface Respuesta {
  pregunta: string;
  sql: string;
  explicacion: string;
  grafico: string;
  columnas: string[];
  filas: Record<string, unknown>[];
  truncado: boolean;
  modelo: string;
}

const pregunta = ref('¿Qué tiendas me tienen que pagar mañana?');
const respuesta = ref<Respuesta | null>(null);
const cargando = ref(false);
const error = ref<string | null>(null);
const verSql = ref(false);

// Sin señal: la pregunta se encola y se puede mirar un reporte guardado en este equipo
const orgId = props.sesion.usuario.orgId;
const sinSenal = ref(typeof navigator !== 'undefined' && navigator.onLine === false);
const pendientes = ref<string[]>(preguntasPendientes(orgId));
const guardados = ref<ReporteGuardado[]>(reportesGuardados(orgId));
/** Si lo que se ve es un reporte guardado, de cuándo es */
const deGuardado = ref<string | null>(null);
const aviso = ref<string | null>(null);

function mostrarGuardado(r: ReporteGuardado) {
  respuesta.value = r;
  deGuardado.value = cuandoSeGuardo(r.guardadoEn);
}

function quedarSinSenal(texto: string) {
  sinSenal.value = true;
  pendientes.value = encolarPregunta(orgId, texto);
  const guardado = buscarGuardado(orgId, texto);
  if (guardado) mostrarGuardado(guardado);
  aviso.value = guardado
    ? 'Sin señal: te mostramos el último reporte guardado de esta pregunta. Se actualiza solo al volver la señal.'
    : 'Sin señal: tu pregunta quedó guardada y se responde sola al volver la señal.';
}

// Lo dicho por voz se escribe en la caja (para que se vea qué se entendió) y se pregunta solo
const voz = usarVoz((texto) => {
  pregunta.value = texto;
  void preguntar();
}, props.voz);

const serie = computed(() =>
  respuesta.value ? armarSerie(respuesta.value.columnas, respuesta.value.filas, respuesta.value.grafico) : null,
);

/** Pregunta al Asistente y guarda la respuesta en este equipo para cuando no haya señal. */
async function responder(texto: string): Promise<Respuesta> {
  const r = await llamarAsistente<Respuesta>(props.sesion, '/v1/reportes/preguntas', {
    metodo: 'POST',
    cuerpo: { texto },
  });
  guardarReporte(orgId, r);
  guardados.value = reportesGuardados(orgId);
  return r;
}

async function preguntar() {
  const texto = pregunta.value.trim();
  if (texto.length < 3) return;
  error.value = null;
  aviso.value = null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return quedarSinSenal(texto);
  cargando.value = true;
  try {
    respuesta.value = await responder(texto);
    deGuardado.value = null;
    sinSenal.value = false;
  } catch (e) {
    if (esFaltaDeRed(e)) quedarSinSenal(texto);
    else error.value = (e as Error).message;
  } finally {
    cargando.value = false;
  }
}

/** Al volver la señal responde lo que quedó en la cola, en orden, y muestra la última. */
async function responderPendientes() {
  sinSenal.value = false;
  const cola = preguntasPendientes(orgId);
  if (!cola.length) return;
  const respondidas: string[] = [];
  for (const texto of cola) {
    try {
      respuesta.value = await responder(texto);
      deGuardado.value = null;
      pregunta.value = texto;
      pendientes.value = quitarPendiente(orgId, texto);
      respondidas.push(texto);
    } catch (e) {
      if (esFaltaDeRed(e)) return quedarSinSenal(texto);
      // El Asistente no la pudo responder: sale de la cola y se dice por qué
      pendientes.value = quitarPendiente(orgId, texto);
      error.value = `«${texto}»: ${(e as Error).message}`;
    }
  }
  if (respondidas.length) {
    aviso.value =
      respondidas.length === 1
        ? 'Volvió la señal: respondimos la pregunta que dejaste guardada.'
        : `Volvió la señal: respondimos las ${respondidas.length} preguntas que dejaste guardadas.`;
  }
}

const alPerderSenal = () => (sinSenal.value = true);
onMounted(() => {
  window.addEventListener('online', responderPendientes);
  window.addEventListener('offline', alPerderSenal);
  if (pendientes.value.length && navigator.onLine !== false) void responderPendientes();
});
onUnmounted(() => {
  window.removeEventListener('online', responderPendientes);
  window.removeEventListener('offline', alPerderSenal);
});

async function exportar() {
  if (!respuesta.value) return;
  const archivo = await llamarAsistente<Blob>(props.sesion, '/v1/reportes/excel', {
    metodo: 'POST',
    cuerpo: { titulo: respuesta.value.pregunta.slice(0, 60), columnas: respuesta.value.columnas, filas: respuesta.value.filas },
  });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = 'reporte-abasto.xlsx';
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}
</script>

<template>
  <div class="cabecera">
    <h1 class="titulo-pantalla">Reportes e inteligencia</h1>
  </div>

  <form class="pregunta carta" @submit.prevent="preguntar">
    <!-- La voz se transcribe con Whisper dentro del navegador: el audio no sale del equipo -->
    <button
      type="button"
      class="boton-secundario microfono"
      :class="{ grabando: voz.estado.value === 'grabando' }"
      :disabled="voz.estado.value === 'transcribiendo' || cargando"
      :aria-pressed="voz.estado.value === 'grabando'"
      @click="voz.alternar"
    >
      {{ voz.textoDelBoton.value }}
    </button>
    <input v-model="pregunta" class="entrada" aria-label="Pregunta algo sobre tus datos" placeholder="Pregunta algo sobre tus datos" />
    <button class="boton-primario" :disabled="cargando">{{ cargando ? 'Pensando…' : 'Preguntar' }}</button>
  </form>

  <p v-if="voz.error.value" class="falla">{{ voz.error.value }}</p>
  <p v-if="error" class="falla">{{ error }}</p>
  <p v-if="aviso" class="aviso-senal" role="status">{{ aviso }}</p>

  <div v-if="pendientes.length" class="carta pendientes">
    <strong>Esperan señal ({{ pendientes.length }})</strong>
    <ul><li v-for="p in pendientes" :key="p">{{ p }}</li></ul>
  </div>

  <section v-if="respuesta" class="carta resultado">
    <div class="encabezado">
      <div>
        <strong>{{ respuesta.explicacion }}</strong>
        <span class="gris">
          {{ respuesta.filas.length }} filas · modelo {{ respuesta.modelo }}
          <template v-if="deGuardado"> · guardado el {{ deGuardado }}</template>
        </span>
      </div>
      <div class="acciones">
        <button class="boton-secundario" @click="verSql = !verSql">{{ verSql ? 'Ocultar SQL' : 'Ver SQL' }}</button>
        <button class="boton-primario" :disabled="sinSenal" :title="sinSenal ? 'Exportar a Excel necesita señal' : undefined" @click="exportar">
          Exportar a Excel
        </button>
      </div>
    </div>
    <pre v-if="verSql" class="sql">{{ respuesta.sql }}</pre>
    <Grafico v-if="serie" :serie="serie" :tipo="respuesta.grafico === 'linea' ? 'linea' : 'barras'" />
    <p v-if="!respuesta.filas.length" class="vacio">No hay datos para esa pregunta.</p>
    <table v-else>
      <thead>
        <tr><th v-for="c in respuesta.columnas" :key="c">{{ encabezado(c) }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="(fila, i) in respuesta.filas" :key="i">
          <td v-for="c in respuesta.columnas" :key="c" :class="{ num: c.endsWith('_centavos') }">{{ formatearCelda(c, fila[c]) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="respuesta.truncado" class="gris">
      {{ deGuardado ? 'En este equipo se guardaron las primeras 200 filas.' : 'Se muestran las primeras 1.000 filas.' }}
    </p>
  </section>

  <section v-if="guardados.length" class="guardados">
    <h3>Guardados en este equipo <span class="gris">(se ven sin señal)</span></h3>
    <div class="lista-guardados">
      <button v-for="g in guardados" :key="g.guardadoEn + g.pregunta" class="boton-secundario" @click="mostrarGuardado(g)">
        {{ g.pregunta }} <span class="gris">· {{ cuandoSeGuardo(g.guardadoEn) }}</span>
      </button>
    </div>
  </section>
</template>

<style>
.pregunta { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
.pregunta .entrada { flex: 1; }
.microfono.grabando { border-color: hsl(var(--error-suave-texto)); color: hsl(var(--error-suave-texto)); background: hsl(var(--error-suave)); }
.resultado .encabezado { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.aviso-senal { margin: 0 0 1rem; padding: 0.6rem 0.9rem; border-radius: var(--radio); background: hsl(38 95% 90%); color: hsl(30 80% 25%); }
.pendientes { margin-bottom: 1rem; }
.pendientes ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
.guardados { margin-top: 1.5rem; }
.guardados h3 { margin: 0 0 0.6rem; font-family: var(--fuente-titulo); }
.lista-guardados { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.sql { background: hsl(var(--tinta)); color: hsl(var(--tinta-texto)); padding: 1rem; border-radius: var(--radio); font-family: var(--fuente-mono); font-size: 0.75rem; white-space: pre-wrap; }
</style>
