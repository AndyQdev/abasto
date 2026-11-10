<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { armarSerie } from '../graficos/serie';
import { kpisDe, porcionesDe, resumenDe, type BloqueDelReporte, type PlantillaDeBloque } from '../reportes/conversacion';
import { encabezado, formatearCelda } from '../sesion';
import Dona from './Dona.vue';
import Grafico from './Grafico.vue';
import Icono, { type NombreDeIcono } from './Icono.vue';

/**
 * Un bloque de la mesa: una plantilla (KPIs, línea, barras, dona o tabla) llena con los datos de su consulta.
 * «Ver como» cambia la plantilla entre las que encajan con esos datos (las decide el Asistente); «Ver datos» abre la
 * tabla debajo de un gráfico. El primer bloque es el que responde la pregunta.
 */
const props = defineProps<{ bloque: BloqueDelReporte; principal?: boolean }>();

const vista = ref<PlantillaDeBloque>(props.bloque.plantilla);
watch(
  () => props.bloque,
  (b) => (vista.value = b.plantilla),
);
const verDatos = ref(false);

const NOMBRES: Record<PlantillaDeBloque, string> = { kpis: 'Números', linea: 'Línea', barras: 'Barras', dona: 'Dona', tabla: 'Tabla' };
const ICONOS: Record<PlantillaDeBloque, NombreDeIcono> = { kpis: 'numeros', linea: 'linea', barras: 'barras', dona: 'dona', tabla: 'tabla' };
const opciones = computed(() => (props.bloque.alternativas.length ? props.bloque.alternativas : [props.bloque.plantilla]));

const sinDatos = computed(() => !props.bloque.filas.length);
const esAviso = computed(() => props.bloque.columnas.length === 1 && props.bloque.columnas[0] === 'aviso');
const serie = computed(() =>
  vista.value === 'barras' || vista.value === 'linea' || vista.value === 'dona'
    ? armarSerie(props.bloque.columnas, props.bloque.filas, vista.value)
    : null,
);
const kpis = computed(() => (vista.value === 'kpis' ? kpisDe(props.bloque) : []));
const porciones = computed(() => (vista.value === 'dona' && serie.value ? porcionesDe(props.bloque, serie.value.columnaEtiqueta, serie.value.columnaValor) : []));
const totalDona = computed(() =>
  serie.value ? formatearCelda(serie.value.columnaValor, serie.value.puntos.reduce((s, p) => s + p.valor, 0)) : '',
);
const resumen = computed(() =>
  vista.value === 'barras' && serie.value ? resumenDe(props.bloque, serie.value.columnaEtiqueta, serie.value.columnaValor) : [],
);
// Postgres manda las sumas (bigint) y los numeric como texto: «133000» también es un número
const esNumerica = (c: string) =>
  props.bloque.filas.every((f) => f[c] === null || typeof f[c] === 'number' || (typeof f[c] === 'string' && /^-?\d+(\.\d+)?$/.test(f[c] as string)));
const ancho = computed(() => vista.value === 'kpis' || vista.value === 'tabla' || (vista.value === 'linea' && props.principal));
</script>

<template>
  <section class="rp-bloque" :class="[`rp-bloque-${vista}`, { ancho, principal }]" :aria-label="bloque.titulo">
    <header class="rp-bloque-cabecera">
      <h3>{{ bloque.titulo }}</h3>
      <div v-if="!sinDatos && !esAviso" class="rp-bloque-acciones">
        <div v-if="opciones.length > 1" class="rp-ver-como" role="group" :aria-label="`Ver ${bloque.titulo} como`">
          <button
            v-for="o in opciones"
            :key="o"
            :aria-pressed="vista === o"
            :title="`Ver como ${NOMBRES[o].toLowerCase()}`"
            @click="vista = o"
          >
            <Icono :nombre="ICONOS[o]" :tamano="14" /><span>{{ NOMBRES[o] }}</span>
          </button>
        </div>
        <button v-if="vista !== 'tabla'" class="rp-boton-chico" :aria-pressed="verDatos" @click="verDatos = !verDatos">
          <Icono nombre="tabla" :tamano="14" />{{ verDatos ? 'Ocultar datos' : 'Ver datos' }}
        </button>
      </div>
    </header>
    <p v-if="bloque.aviso && vista === bloque.plantilla && bloque.pedida !== bloque.plantilla" class="rp-bloque-aviso gris">
      Se muestra como {{ NOMBRES[bloque.plantilla].toLowerCase() }}: {{ bloque.aviso.charAt(0).toLowerCase() + bloque.aviso.slice(1) }}.
    </p>

    <div v-if="esAviso" class="rp-sin-datos">
      <Icono nombre="aviso" :tamano="20" /><span>No tengo datos para responder eso.</span>
    </div>
    <p v-else-if="sinDatos" class="rp-sin-datos">
      <Icono nombre="aviso" :tamano="20" /><span>No hay datos en este período.</span>
    </p>

    <template v-else>
      <div v-if="vista === 'kpis'" class="rp-numeros">
        <div v-for="(n, i) in kpis" :key="n.etiqueta" class="rp-numero" :class="{ principal: principal && i === 0 }">
          <span class="rp-numero-etiqueta">{{ n.etiqueta }}</span>
          <strong>{{ n.valor }}</strong>
          <span v-if="n.variacion" class="rp-variacion" :class="n.variacion.sentido">
            <b>{{ n.variacion.sentido === 'sube' ? '▲' : n.variacion.sentido === 'baja' ? '▼' : '●' }} {{ n.variacion.texto }}</b>
            {{ n.variacion.antes }}
          </span>
          <span v-else-if="n.detalle" class="rp-numero-detalle">{{ n.detalle }}</span>
        </div>
      </div>

      <Dona v-else-if="vista === 'dona' && porciones.length" :porciones="porciones" :total="totalDona" :titulo="bloque.titulo" />

      <template v-else-if="(vista === 'barras' || vista === 'linea') && serie">
        <div v-if="resumen.length" class="rp-resumen">
          <div v-for="d in resumen" :key="d.etiqueta" class="rp-dato">
            <span>{{ d.etiqueta }}</span>
            <strong>{{ d.valor }}</strong>
            <small v-if="d.detalle">{{ d.detalle }}</small>
          </div>
        </div>
        <div class="rp-lienzo">
          <Grafico :serie="serie" :tipo="vista" />
        </div>
      </template>

      <div v-if="vista === 'tabla' || verDatos" class="rp-tabla">
        <table>
          <thead>
            <tr><th v-for="c in bloque.columnas" :key="c" :class="{ num: esNumerica(c) }">{{ encabezado(c) }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(fila, i) in bloque.filas" :key="i">
              <td v-for="c in bloque.columnas" :key="c" :class="{ num: esNumerica(c) }">{{ formatearCelda(c, fila[c]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
