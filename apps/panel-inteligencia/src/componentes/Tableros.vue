<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatearCelda, llamarAsistente, type SesionDelShell } from '../sesion';
import {
  productosEnRiesgo,
  serieDeDemanda,
  serieDeFormasDePago,
  serieDeMasVendidos,
  serieDeSegmentos,
  serieDeVentas,
  textoDeDias,
  textoDeRiesgo,
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
const masVendidos = computed(() => serieDeMasVendidos(tableros.value?.masVendidos ?? []));
const formasDePago = computed(() => serieDeFormasDePago(tableros.value?.formasDePago ?? []));
const teDeben = computed(() => tableros.value?.teDeben ?? []);
const mora = computed(() => tableros.value?.mora ?? []);
const nuevas = computed(() => tableros.value?.tiendas?.nuevas ?? []);
const dejaron = computed(() => tableros.value?.tiendas?.dejaron ?? []);

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

    <article class="carta tablero-medio tablero-te-deben">
      <h3>Quién te debe</h3>
      <table v-if="teDeben.length">
        <thead>
          <tr>
            <th>Tienda</th>
            <th>Debe</th>
            <th>Vence</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in teDeben" :key="t.tienda_id" :class="{ vencida: t.vencida }">
            <td>{{ t.tienda_nombre }}</td>
            <td class="num">{{ formatearCelda('saldo_centavos', t.saldo_centavos) }}</td>
            <td>{{ t.vencida ? `Vencida (${formatearCelda('vence', t.vence)})` : formatearCelda('vence', t.vence) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="vacio">Nadie te debe: todas las cuentas están pagadas.</p>
      <p class="gris">{{ tableros.cobranza.vencen_esta_semana }} cuentas vencen esta semana.</p>
    </article>

    <article class="carta tablero-medio tablero-mora">
      <h3>Riesgo de que te paguen tarde</h3>
      <table v-if="mora.length">
        <thead>
          <tr>
            <th>Tienda</th>
            <th>Riesgo</th>
            <th>Debe</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in mora" :key="m.tienda_id">
            <td>{{ m.tienda_nombre }}</td>
            <td><span class="riesgo" :class="textoDeRiesgo(m.riesgo).nivel">{{ textoDeRiesgo(m.riesgo).texto }}</span></td>
            <td class="num">{{ formatearCelda('saldo_centavos', m.saldo_centavos) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="vacio">El ML nocturno todavía no calculó el riesgo (<code>uv run abasto-ml-nocturno</code>).</p>
      <p class="gris">Modelo supervisado (regresión logística) con lo que debe cada tienda, sus atrasos y su antigüedad.</p>
    </article>

    <article class="carta tablero-medio tablero-mas-vendidos">
      <h3>Lo que más se vende</h3>
      <Grafico v-if="masVendidos.puntos.length" :serie="masVendidos" tipo="barras" />
      <p v-else class="vacio">Todavía no hay ventas por producto.</p>
      <p class="gris">Unidades por mes, con el promedio de los últimos 30 días.</p>
    </article>

    <article class="carta tablero-medio tablero-formas-de-pago">
      <h3>Cómo te pagan</h3>
      <Grafico v-if="formasDePago.puntos.length" :serie="formasDePago" tipo="barras" />
      <p v-else class="vacio">No hubo pedidos en los últimos 30 días.</p>
      <p class="gris">Pedidos de los últimos 30 días por forma de pago.</p>
    </article>

    <article class="carta tablero-ancho tablero-tiendas">
      <h3>Tiendas nuevas y las que dejaron de comprar</h3>
      <div class="dos-columnas">
        <div>
          <p class="gris">Nuevas en 30 días ({{ nuevas.length }})</p>
          <ul v-if="nuevas.length">
            <li v-for="t in nuevas" :key="t.tienda_id">{{ t.tienda_nombre }} <span class="gris">desde {{ formatearCelda('desde', t.desde) }}</span></li>
          </ul>
          <p v-else class="vacio">Ninguna tienda nueva este mes.</p>
        </div>
        <div>
          <p class="gris">No compran hace más de 30 días ({{ dejaron.length }})</p>
          <ul v-if="dejaron.length">
            <li v-for="t in dejaron" :key="t.tienda_id">{{ t.tienda_nombre }} <span class="gris">última compra {{ formatearCelda('ultima', t.ultima) }}</span></li>
          </ul>
          <p v-else class="vacio">Todas tus tiendas siguen comprando.</p>
        </div>
      </div>
    </article>
  </div>
</template>

<style>
.tableros { display: grid; gap: 1rem; }
.tableros h3 { margin: 0 0 0.75rem; font-family: var(--fuente-titulo); }
.tableros tr.vencida td { color: hsl(var(--peligro, 0 70% 45%)); }
.riesgo { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-weight: 600; font-size: 0.85em; }
.riesgo.alto { background: hsl(0 80% 92%); color: hsl(0 65% 38%); }
.riesgo.medio { background: hsl(38 95% 88%); color: hsl(30 80% 30%); }
.riesgo.bajo { background: hsl(140 50% 90%); color: hsl(145 55% 25%); }
.dos-columnas { display: grid; gap: 1rem; }
.dos-columnas ul { margin: 0.25rem 0 0; padding-left: 1.1rem; }
@media (min-width: 700px) { .dos-columnas { grid-template-columns: 1fr 1fr; } }
@media (min-width: 900px) {
  .tableros { grid-template-columns: 1fr 1fr; }
  .tablero-ancho { grid-column: 1 / -1; }
}
</style>
