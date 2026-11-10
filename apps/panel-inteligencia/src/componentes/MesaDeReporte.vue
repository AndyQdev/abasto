<script setup lang="ts">
import { computed, ref } from 'vue';
import { armarSerie } from '../graficos/serie';
import { horaCorta, numerosDe, plantillaDe, resumenDe, type Reporte } from '../reportes/conversacion';
import { encabezado, formatearCelda } from '../sesion';
import Grafico from './Grafico.vue';
import Icono from './Icono.vue';

/** Un reporte armado en la mesa de trabajo. La plantilla sale de la forma de la respuesta (ver `plantillaDe`). */
const props = defineProps<{ reporte: Reporte; sinSenal: boolean; exportando: boolean }>();
defineEmits<{ excel: [reporte: Reporte]; repetir: [pregunta: string] }>();

const verSql = ref(false);
const plantilla = computed(() => plantillaDe(props.reporte));
const serie = computed(() => armarSerie(props.reporte.columnas, props.reporte.filas, props.reporte.grafico));
const numeros = computed(() => (plantilla.value === 'numeros' ? numerosDe(props.reporte) : []));
const resumen = computed(() => (serie.value ? resumenDe(props.reporte, serie.value.columnaEtiqueta, serie.value.columnaValor) : []));
// Postgres manda las sumas (bigint) y los numeric como texto: «133000» también es un número
const esNumerica = (c: string) =>
  props.reporte.filas.every((f) => f[c] === null || typeof f[c] === 'number' || (typeof f[c] === 'string' && /^-?\d+(\.\d+)?$/.test(f[c] as string)));
</script>

<template>
  <article class="rp-reporte" :aria-label="reporte.pregunta">
    <header class="rp-reporte-cabecera">
      <div>
        <h2>{{ reporte.pregunta }}</h2>
        <p class="rp-explicacion">{{ reporte.explicacion }}</p>
        <span class="gris">
          {{ reporte.filas.length }} {{ reporte.filas.length === 1 ? 'fila' : 'filas' }} · {{ reporte.modelo }} ·
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
          :disabled="sinSenal || exportando || !reporte.filas.length"
          :title="sinSenal ? 'Exportar a Excel necesita señal' : undefined"
          @click="$emit('excel', reporte)"
        >
          <Icono nombre="descargar" :tamano="15" />{{ exportando ? 'Preparando…' : 'Exportar a Excel' }}
        </button>
      </div>
    </header>

    <pre v-if="verSql" class="rp-sql">{{ reporte.sql }}</pre>

    <div v-if="plantilla === 'numeros'" class="rp-numeros">
      <div v-for="(n, i) in numeros" :key="n.etiqueta" class="rp-numero" :class="{ principal: i === 0 }">
        <span class="rp-numero-etiqueta">{{ n.etiqueta }}</span>
        <strong>{{ n.valor }}</strong>
        <span v-if="n.detalle" class="rp-numero-detalle">{{ n.detalle }}</span>
      </div>
    </div>

    <div v-else-if="plantilla === 'aviso'" class="rp-sin-datos">
      <Icono nombre="aviso" :tamano="22" />
      <div>
        <strong>No tengo datos para responder eso</strong>
        <p>{{ reporte.explicacion }}</p>
      </div>
    </div>

    <p v-else-if="plantilla === 'vacio'" class="rp-sin-datos">
      <Icono nombre="aviso" :tamano="22" />
      <span>No hay datos para esa pregunta en este período.</span>
    </p>

    <template v-else>
      <div v-if="resumen.length && serie" class="rp-resumen">
        <div v-for="d in resumen" :key="d.etiqueta" class="rp-dato">
          <span>{{ d.etiqueta }}</span>
          <strong>{{ d.valor }}</strong>
          <small v-if="d.detalle">{{ d.detalle }}</small>
        </div>
      </div>
      <div v-if="serie" class="rp-lienzo">
        <Grafico :serie="serie" :tipo="plantilla === 'linea' ? 'linea' : 'barras'" />
      </div>
    </template>

    <div v-if="plantilla !== 'aviso' && plantilla !== 'vacio'" class="rp-tabla">
      <table>
        <thead>
          <tr><th v-for="c in reporte.columnas" :key="c" :class="{ num: esNumerica(c) }">{{ encabezado(c) }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(fila, i) in reporte.filas" :key="i">
            <td v-for="c in reporte.columnas" :key="c" :class="{ num: esNumerica(c) }">{{ formatearCelda(c, fila[c]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="reporte.truncado" class="gris rp-recortado">
      {{ reporte.deGuardado ? 'En este equipo se guardaron las primeras 200 filas.' : 'Se muestran las primeras 1.000 filas.' }}
    </p>
  </article>
</template>
