<script setup lang="ts">
import { computed } from 'vue';
import { encabezado, formatearCelda } from '../sesion';
import type { Serie } from '../graficos/serie';

/** Barras horizontales o línea en SVG, sin librerías. Colores y letras salen de los tokens del Panel. */
const props = defineProps<{ serie: Serie; tipo: 'barras' | 'linea' }>();

const ANCHO = 640;
const ALTO_LINEA = 220;
const ALTO_BARRA = 26;
const MARGEN_ETIQUETA = 170;

const maximo = computed(() => Math.max(...props.serie.puntos.map((p) => p.valor), 1));
const etiqueta = (v: unknown) => formatearCelda(props.serie.columnaEtiqueta, v);
const valor = (v: number) => formatearCelda(props.serie.columnaValor, v);

const barras = computed(() =>
  props.serie.puntos.map((p, i) => ({
    ...p,
    y: i * ALTO_BARRA,
    largo: Math.max(2, ((ANCHO - MARGEN_ETIQUETA - 110) * p.valor) / maximo.value),
  })),
);

const puntosDeLinea = computed(() => {
  const n = props.serie.puntos.length;
  return props.serie.puntos.map((p, i) => ({
    ...p,
    x: n === 1 ? ANCHO / 2 : 40 + (i * (ANCHO - 80)) / (n - 1),
    y: ALTO_LINEA - 30 - ((ALTO_LINEA - 60) * p.valor) / maximo.value,
  }));
});

const trazo = computed(() => puntosDeLinea.value.map((p) => `${p.x},${p.y}`).join(' '));
// «tienda_nombre» se lee «tienda»: el título queda «Saldo por tienda»
const titulo = computed(
  () => `${encabezado(props.serie.columnaValor)} por ${encabezado(props.serie.columnaEtiqueta).replace(/ nombre$/i, '').toLowerCase()}`,
);
</script>

<template>
  <figure class="grafico">
    <figcaption class="gris">{{ titulo }}</figcaption>
    <svg
      v-if="tipo === 'barras'"
      :viewBox="`0 0 ${ANCHO} ${barras.length * ALTO_BARRA}`"
      role="img"
      :aria-label="titulo"
    >
      <g v-for="b in barras" :key="String(b.etiqueta)" :transform="`translate(0 ${b.y})`">
        <text x="0" :y="ALTO_BARRA / 2" dominant-baseline="middle" class="texto">{{ etiqueta(b.etiqueta) }}</text>
        <rect :x="MARGEN_ETIQUETA" y="5" :width="b.largo" :height="ALTO_BARRA - 10" rx="4" class="barra" />
        <text :x="MARGEN_ETIQUETA + b.largo + 8" :y="ALTO_BARRA / 2" dominant-baseline="middle" class="texto valor">
          {{ valor(b.valor) }}
        </text>
      </g>
    </svg>
    <svg v-else :viewBox="`0 0 ${ANCHO} ${ALTO_LINEA}`" role="img" :aria-label="titulo">
      <line :x1="40" :x2="ANCHO - 40" :y1="ALTO_LINEA - 30" :y2="ALTO_LINEA - 30" class="eje" />
      <polyline :points="trazo" class="linea" />
      <g v-for="(p, i) in puntosDeLinea" :key="i">
        <circle :cx="p.x" :cy="p.y" r="3.5" class="punto"><title>{{ etiqueta(p.etiqueta) }}: {{ valor(p.valor) }}</title></circle>
        <text
          v-if="i === 0 || i === puntosDeLinea.length - 1"
          :x="p.x"
          :y="ALTO_LINEA - 10"
          text-anchor="middle"
          class="texto"
        >
          {{ etiqueta(p.etiqueta) }}
        </text>
      </g>
    </svg>
  </figure>
</template>

<style>
.grafico { margin: 0 0 1.25rem; }
.grafico figcaption { margin-bottom: 0.5rem; }
.grafico svg { width: 100%; height: auto; max-height: 340px; }
.grafico .texto { font-family: var(--fuente-sans); font-size: 11px; fill: hsl(var(--texto-2)); }
.grafico .valor { fill: hsl(var(--texto)); font-variant-numeric: tabular-nums; }
.grafico .barra { fill: hsl(var(--primary)); }
.grafico .linea { fill: none; stroke: hsl(var(--primary)); stroke-width: 2.5; stroke-linejoin: round; }
.grafico .punto { fill: hsl(var(--primary)); }
.grafico .eje { stroke: hsl(var(--borde)); }
</style>
