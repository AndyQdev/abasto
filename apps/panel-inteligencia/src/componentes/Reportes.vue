<script setup lang="ts">
import { ref } from 'vue';
import { encabezado, formatearCelda, llamarAsistente, type SesionDelShell } from '../sesion';

const props = defineProps<{ sesion: SesionDelShell }>();

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

async function preguntar() {
  if (pregunta.value.trim().length < 3) return;
  cargando.value = true;
  error.value = null;
  try {
    respuesta.value = await llamarAsistente<Respuesta>(props.sesion, '/v1/reportes/preguntas', {
      metodo: 'POST',
      cuerpo: { texto: pregunta.value },
    });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    cargando.value = false;
  }
}

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
    <!-- La voz se transcribe con Whisper dentro del navegador (tarea de F5); el audio no sale del equipo -->
    <button type="button" class="boton-secundario" disabled title="F5: voz con Whisper en el navegador">Micrófono</button>
    <input v-model="pregunta" class="entrada" aria-label="Pregunta algo sobre tus datos" placeholder="Pregunta algo sobre tus datos" />
    <button class="boton-primario" :disabled="cargando">{{ cargando ? 'Pensando…' : 'Preguntar' }}</button>
  </form>

  <p v-if="error" class="falla">{{ error }}</p>

  <section v-if="respuesta" class="carta resultado">
    <div class="encabezado">
      <div>
        <strong>{{ respuesta.explicacion }}</strong>
        <span class="gris">{{ respuesta.filas.length }} filas · modelo {{ respuesta.modelo }}</span>
      </div>
      <div class="acciones">
        <button class="boton-secundario" @click="verSql = !verSql">{{ verSql ? 'Ocultar SQL' : 'Ver SQL' }}</button>
        <button class="boton-primario" @click="exportar">Exportar a Excel</button>
      </div>
    </div>
    <pre v-if="verSql" class="sql">{{ respuesta.sql }}</pre>
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
    <p v-if="respuesta.truncado" class="gris">Se muestran las primeras 1.000 filas.</p>
  </section>
</template>

<style>
.pregunta { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
.pregunta .entrada { flex: 1; }
.resultado .encabezado { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.sql { background: hsl(var(--tinta)); color: hsl(var(--tinta-texto)); padding: 1rem; border-radius: var(--radio); font-family: var(--fuente-mono); font-size: 0.75rem; white-space: pre-wrap; }
</style>
