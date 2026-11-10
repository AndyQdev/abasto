<script setup lang="ts">
import { computed } from 'vue';
import type { Porcion } from '../reportes/conversacion';

/**
 * Dona (torta) en SVG, sin librerías: cómo se reparte un total. Cada parte lleva su nombre, monto y porcentaje en
 * la leyenda (nunca solo el color), un hueco de 2 px entre porciones y el total en el centro. Colores validados con
 * el validador de paletas (6 tonos; lo que sobra va en «Otros», gris).
 */
const props = defineProps<{ porciones: Porcion[]; total: string; titulo: string }>();

const R = 70;
const GROSOR = 26;
const C = 2 * Math.PI * R;
const formatoPorciento = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 });

const arcos = computed(() => {
  let acumulado = 0;
  return props.porciones.map((p, i) => {
    const largo = (p.porciento / 100) * C;
    const arco = { ...p, i, largo, inicio: acumulado };
    acumulado += largo;
    return arco;
  });
});
</script>

<template>
  <figure class="dona">
    <svg viewBox="0 0 180 180" role="img" :aria-label="titulo">
      <g transform="rotate(-90 90 90)">
        <circle
          v-for="a in arcos"
          :key="a.etiqueta"
          cx="90"
          cy="90"
          :r="R"
          fill="none"
          :stroke-width="GROSOR"
          :class="['porcion', a.otros ? 'otros' : `c${a.i + 1}`]"
          :stroke-dasharray="`${Math.max(a.largo - (arcos.length > 1 ? 2 : 0), 0.5)} ${C}`"
          :stroke-dashoffset="-a.inicio"
        >
          <title>{{ a.etiqueta }}: {{ a.texto }} ({{ formatoPorciento.format(a.porciento) }} %)</title>
        </circle>
      </g>
      <text x="90" y="86" text-anchor="middle" class="centro-etiqueta">Total</text>
      <text x="90" y="104" text-anchor="middle" class="centro-valor">{{ total }}</text>
    </svg>
    <ul class="dona-leyenda">
      <li v-for="a in arcos" :key="a.etiqueta">
        <i :class="['muestra', a.otros ? 'otros' : `c${a.i + 1}`]" />
        <span class="nombre">{{ a.etiqueta }}</span>
        <strong>{{ formatoPorciento.format(a.porciento) }} %</strong>
        <small>{{ a.texto }}</small>
      </li>
    </ul>
  </figure>
</template>

<style>
.dona {
  --dona-1: #1a8c5a; --dona-2: #e3a02f; --dona-3: #3e7fb0; --dona-4: #d8664b; --dona-5: #8db33a; --dona-6: #9b5ba6; --dona-otros: #a3aca7;
  display: grid; grid-template-columns: minmax(140px, 190px) 1fr; align-items: center; gap: 1.25rem; margin: 0;
}
.dona svg { width: 100%; height: auto; }
.dona .porcion { transition: opacity 0.15s; }
.dona svg:hover .porcion { opacity: 0.55; }
.dona svg .porcion:hover { opacity: 1; }
.dona .c1 { stroke: var(--dona-1); background: var(--dona-1); }
.dona .c2 { stroke: var(--dona-2); background: var(--dona-2); }
.dona .c3 { stroke: var(--dona-3); background: var(--dona-3); }
.dona .c4 { stroke: var(--dona-4); background: var(--dona-4); }
.dona .c5 { stroke: var(--dona-5); background: var(--dona-5); }
.dona .c6 { stroke: var(--dona-6); background: var(--dona-6); }
.dona .otros { stroke: var(--dona-otros); background: var(--dona-otros); }
.dona .centro-etiqueta { font-family: var(--fuente-sans); font-size: 10px; fill: hsl(var(--texto-3)); text-transform: uppercase; letter-spacing: 0.08em; }
.dona .centro-valor { font-family: var(--fuente-titulo); font-size: 14px; font-weight: 800; fill: hsl(var(--texto)); font-variant-numeric: tabular-nums; }
.dona-leyenda { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
.dona-leyenda li { display: grid; grid-template-columns: 12px 1fr auto; column-gap: 0.55rem; align-items: center; font-size: 0.8125rem; }
.dona-leyenda .muestra { width: 12px; height: 12px; border-radius: 4px; }
.dona-leyenda .nombre { color: hsl(var(--texto)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dona-leyenda strong { font-variant-numeric: tabular-nums; color: hsl(var(--texto)); }
.dona-leyenda small { grid-column: 2 / -1; color: hsl(var(--texto-3)); font-variant-numeric: tabular-nums; }
@media (max-width: 520px) { .dona { grid-template-columns: 1fr; } .dona svg { max-width: 200px; justify-self: center; } }
@media (prefers-color-scheme: dark) { .dona { --dona-otros: #6f7873; } }
</style>
