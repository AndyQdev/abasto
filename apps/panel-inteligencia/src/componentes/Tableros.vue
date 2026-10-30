<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatearCelda, llamarAsistente, type SesionDelShell } from '../sesion';
import {
  productosEnRiesgo,
  serieDeDemanda,
  serieDeSegmentos,
  serieDeVentas,
  textoDeDias,
  totalDeVentas,
  type Tableros,
} from '../tableros/tableros';
import Grafico from './Grafico.vue';

const props = defineProps<{ sesion: SesionDelShell }>();

const tableros = ref<Tableros | null>(null);
const error = ref<string | null>(null);

const riesgo = computed(() => productosEnRiesgo(tableros.value?.demanda ?? []));
const ventas = computed(() => serieDeVentas(tableros.value?.ventas ?? []));
const demanda = computed(() => serieDeDemanda(tableros.value?.demanda ?? []));
const segmentos = computed(() => serieDeSegmentos(tableros.value?.segmentos ?? []));

async function cargar() {
  try {
    tableros.value = await llamarAsistente<Tableros>(props.sesion, '/v1/tableros');
    error.value = null;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="cabecera">
    <h1 class="titulo-pantalla">Tableros</h1>
    <div v-if="tableros" class="contadores">
      <div>
        <strong>{{ formatearCelda('total_centavos', totalDeVentas(tableros.ventas)) }}</strong>Ventas 30 días
      </div>
      <div>
        <strong>{{ formatearCelda('pendiente_centavos', tableros.cobranza.pendiente_centavos) }}</strong>Por cobrar
      </div>
      <div>
        <strong>{{ formatearCelda('vencida_centavos', tableros.cobranza.vencida_centavos) }}</strong>Vencido
        <span class="gris">{{ tableros.cobranza.cuentas_vencidas }} cuentas</span>
      </div>
    </div>
  </div>

  <p v-if="!tableros && !error" class="vacio">Cargando tableros…</p>
  <p v-if="error" class="falla">{{ error }}</p>

  <div v-if="tableros" class="tableros">
    <article class="carta tablero-ancho">
      <h3>Ventas de los últimos 30 días</h3>
      <Grafico v-if="ventas.puntos.length" :serie="ventas" tipo="linea" />
      <p v-else class="vacio">Todavía no hay ventas confirmadas.</p>
    </article>

    <article class="carta tablero-ancho">
      <h3>Se te puede acabar esta semana</h3>
      <table v-if="riesgo.length">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Stock</th>
            <th>Demanda de la semana</th>
            <th>Alcanza para</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in riesgo" :key="p.producto_id">
            <td>{{ p.nombre }}</td>
            <td class="num">{{ p.stock }}</td>
            <td class="num">{{ p.unidades_semana }}</td>
            <td>{{ textoDeDias(p.dias_de_stock) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="vacio">Tu stock alcanza para toda la semana.</p>
    </article>

    <article class="carta tablero-medio">
      <h3>Demanda prevista de la semana</h3>
      <Grafico v-if="demanda.puntos.length" :serie="demanda" tipo="barras" />
      <p v-else class="vacio">Todavía no hay productos con stock para estimar.</p>
      <p class="gris">Modelo supervisado (GradientBoosting) entrenado cada noche con tus ventas.</p>
    </article>

    <article class="carta tablero-medio">
      <h3>Cómo compran tus tiendas</h3>
      <p v-if="!segmentos.puntos.length" class="vacio">Los segmentos salen del ML nocturno: todavía no corrió (<code>uv run abasto-ml-nocturno</code>).</p>
      <Grafico v-if="segmentos.puntos.length" :serie="segmentos" tipo="barras" />
      <table v-if="segmentos.puntos.length">
        <thead>
          <tr>
            <th>Segmento</th>
            <th>Tiendas</th>
            <th>Compras por mes</th>
            <th>Ticket promedio</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in tableros.segmentos" :key="s.segmento">
            <td>{{ s.segmento }}</td>
            <td class="num">{{ s.tiendas }}</td>
            <td class="num">{{ s.compras_mes }}</td>
            <td class="num">{{ formatearCelda('ticket_promedio_centavos', s.ticket_promedio_centavos) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="gris">Segmentos con K-means (no supervisado) según cada cuánto y cuánto compra cada tienda.</p>
    </article>
  </div>
</template>

<style>
.tableros { display: grid; gap: 1rem; }
.tableros h3 { margin: 0 0 0.75rem; font-family: var(--fuente-titulo); }
@media (min-width: 900px) {
  .tableros { grid-template-columns: 1fr 1fr; }
  .tablero-ancho { grid-column: 1 / -1; }
}
</style>
