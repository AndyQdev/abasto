<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  borrarConversacion,
  cargarConversacion,
  guardarConversacion,
  horaCorta,
  nuevoId,
  plantillaDe,
  recortarReportes,
  SUGERENCIAS,
  tituloCorto,
  type Mensaje,
  type Plantilla,
  type Reporte,
  type RespuestaDelAsistente,
} from '../reportes/conversacion';
import { ErrorDelAsistente, llamarAsistente, type SesionDelShell } from '../sesion';
import {
  buscarGuardado,
  cuandoSeGuardo,
  encolarPregunta,
  esFaltaDeRed,
  guardarReporte,
  normalizarPregunta,
  preguntasPendientes,
  quitarPendiente,
  reportesGuardados,
  type ReporteGuardado,
} from '../sin-senal/reportes-sin-senal';
import { usarVoz, type DependenciasDeVoz } from '../voz/usar-voz';
import Icono, { type NombreDeIcono } from './Icono.vue';
import MesaDeReporte from './MesaDeReporte.vue';

/**
 * Reportes como un chat con el Analista. A la izquierda la conversación (por texto o por voz); a la derecha la
 * mesa de trabajo, donde cada respuesta se arma en su pestaña: números, gráfico y tabla para Excel.
 * `voz` solo se pasa en las pruebas: reemplaza el micrófono y el modelo de Whisper.
 */
const props = defineProps<{ sesion: SesionDelShell; voz?: DependenciasDeVoz }>();

const orgId = props.sesion.usuario.orgId;
const nombre = props.sesion.usuario.orgNombre || props.sesion.usuario.nombre;
const conv = reactive(cargarConversacion(orgId));
const texto = ref('');
const pensando = ref(false);
/** La pregunta que se está armando: su pestaña aparece en la mesa antes de que llegue la respuesta */
const armando = ref<string | null>(null);
const exportando = ref(false);
const sinSenal = ref(typeof navigator !== 'undefined' && navigator.onLine === false);
const guardados = ref<ReporteGuardado[]>(reportesGuardados(orgId));
const hilo = ref<HTMLElement | null>(null);
const mesa = ref<HTMLElement | null>(null);

const activo = computed(() => conv.reportes.find((r) => r.id === conv.activa) ?? null);
const ICONOS: Record<Plantilla, NombreDeIcono> = {
  numeros: 'numeros',
  barras: 'barras',
  linea: 'linea',
  tabla: 'tabla',
  aviso: 'aviso',
  vacio: 'tabla',
};
const iconoDe = (r: Reporte) => ICONOS[plantillaDe(r)];
const reporteDe = (id: string) => conv.reportes.find((r) => r.id === id);
const ahora = () => new Date().toISOString();

watch(conv, () => guardarConversacion(orgId, conv), { deep: true });

// --- El hilo ---

function agregar(m: Mensaje) {
  conv.mensajes.push(m);
}

function marcar(id: string, estado: 'respondida' | 'espera-senal') {
  const m = conv.mensajes.find((x) => x.id === id);
  if (m?.de === 'tu') m.estado = estado;
}

function abrirEnLaMesa(r: RespuestaDelAsistente, extra: Partial<Reporte> = {}): Reporte {
  // La misma pregunta otra vez actualiza su pestaña en lugar de abrir una igual al lado
  const igual = normalizarPregunta(r.pregunta);
  const anterior = conv.reportes.find((x) => normalizarPregunta(x.pregunta) === igual);
  const reporte: Reporte = { ...r, id: anterior?.id ?? nuevoId(), hora: ahora(), deGuardado: undefined, ...extra };
  conv.reportes = recortarReportes([...conv.reportes.filter((x) => x.id !== reporte.id), reporte]);
  conv.activa = reporte.id;
  // En el teléfono la mesa queda debajo del chat: se baja hasta el reporte
  if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1000px)').matches) {
    void nextTick(() => mesa.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  return reporte;
}

const enLaMesa = (reporteId: string) => conv.reportes.some((r) => r.id === reporteId);

function verEnLaMesa(reporteId: string) {
  if (enLaMesa(reporteId)) conv.activa = reporteId;
}

function cerrarPestana(id: string) {
  conv.reportes = conv.reportes.filter((r) => r.id !== id);
  if (conv.activa === id) conv.activa = conv.reportes.at(-1)?.id ?? null;
}

function nuevaConversacion() {
  voz.cancelar();
  conv.mensajes = [];
  conv.reportes = [];
  conv.activa = null;
  borrarConversacion(orgId);
}

/** Pregunta al Asistente y guarda la respuesta en este equipo para cuando no haya señal. */
async function responder(pregunta: string): Promise<RespuestaDelAsistente> {
  const r = await llamarAsistente<RespuestaDelAsistente>(props.sesion, '/v1/reportes/preguntas', {
    metodo: 'POST',
    cuerpo: { texto: pregunta },
  });
  guardarReporte(orgId, r);
  guardados.value = reportesGuardados(orgId);
  return r;
}

async function preguntar(entrada?: string, porVoz = false) {
  const pregunta = (entrada ?? texto.value).trim();
  if (pregunta.length < 3 || pensando.value) return;
  texto.value = '';
  const id = nuevoId();
  agregar({ id, de: 'tu', texto: pregunta, hora: ahora(), porVoz, estado: 'enviada' });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return quedarSinSenal(id, pregunta);

  pensando.value = true;
  armando.value = pregunta;
  try {
    const r = await responder(pregunta);
    const reporte = abrirEnLaMesa(r);
    marcar(id, 'respondida');
    agregar({ id: nuevoId(), de: 'analista', tipo: 'reporte', texto: r.explicacion, hora: ahora(), reporteId: reporte.id });
    sinSenal.value = false;
  } catch (e) {
    if (esFaltaDeRed(e)) quedarSinSenal(id, pregunta);
    else {
      marcar(id, 'respondida');
      const opciones = e instanceof ErrorDelAsistente ? e.opciones : [];
      agregar(
        opciones.length
          ? { id: nuevoId(), de: 'analista', tipo: 'aclaracion', texto: (e as Error).message, hora: ahora(), opciones }
          : { id: nuevoId(), de: 'analista', tipo: 'falla', texto: (e as Error).message, hora: ahora() },
      );
    }
  } finally {
    pensando.value = false;
    armando.value = null;
  }
}

/** Sin señal: la pregunta espera en el equipo; si ya hay un reporte guardado de esa pregunta, se muestra. */
function quedarSinSenal(id: string, pregunta: string) {
  sinSenal.value = true;
  marcar(id, 'espera-senal');
  encolarPregunta(orgId, pregunta);
  const guardado = buscarGuardado(orgId, pregunta);
  if (guardado) {
    const cuando = cuandoSeGuardo(guardado.guardadoEn);
    const reporte = abrirEnLaMesa(guardado, { deGuardado: cuando });
    agregar({
      id: nuevoId(),
      de: 'analista',
      tipo: 'reporte',
      texto: `Sin señal: te muestro el último reporte guardado de esta pregunta (${cuando}). Lo actualizo solo al volver la señal.`,
      hora: ahora(),
      reporteId: reporte.id,
    });
  } else {
    agregar({
      id: nuevoId(),
      de: 'analista',
      tipo: 'aviso',
      texto: 'Sin señal: tu pregunta quedó guardada y la respondo sola al volver la señal.',
      hora: ahora(),
    });
  }
}

/** Al volver la señal responde lo que quedó esperando, en orden. */
async function responderPendientes() {
  sinSenal.value = false;
  for (const pregunta of preguntasPendientes(orgId)) {
    const igual = normalizarPregunta(pregunta);
    const burbuja = [...conv.mensajes].reverse().find((m) => m.de === 'tu' && m.estado === 'espera-senal' && normalizarPregunta(m.texto) === igual);
    const id = burbuja?.id ?? nuevoId();
    if (!burbuja) agregar({ id, de: 'tu', texto: pregunta, hora: ahora(), estado: 'espera-senal' });
    pensando.value = true;
    armando.value = pregunta;
    try {
      const r = await responder(pregunta);
      quitarPendiente(orgId, pregunta);
      const reporte = abrirEnLaMesa(r);
      marcar(id, 'respondida');
      agregar({ id: nuevoId(), de: 'analista', tipo: 'reporte', texto: `Volvió la señal. ${r.explicacion}`, hora: ahora(), reporteId: reporte.id });
    } catch (e) {
      if (esFaltaDeRed(e)) {
        sinSenal.value = true;
        return;
      }
      // El Asistente no la pudo responder: sale de la cola y se dice por qué
      quitarPendiente(orgId, pregunta);
      marcar(id, 'respondida');
      agregar({ id: nuevoId(), de: 'analista', tipo: 'falla', texto: `«${pregunta}»: ${(e as Error).message}`, hora: ahora() });
    } finally {
      pensando.value = false;
      armando.value = null;
    }
  }
}

function abrirGuardado(g: ReporteGuardado) {
  abrirEnLaMesa(g, { deGuardado: cuandoSeGuardo(g.guardadoEn) });
}

async function exportar(r: Reporte) {
  exportando.value = true;
  try {
    const archivo = await llamarAsistente<Blob>(props.sesion, '/v1/reportes/excel', {
      metodo: 'POST',
      cuerpo: { titulo: r.pregunta.slice(0, 60), columnas: r.columnas, filas: r.filas },
    });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = 'reporte-abasto.xlsx';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  } catch (e) {
    agregar({ id: nuevoId(), de: 'analista', tipo: 'falla', texto: `No pude armar el Excel: ${(e as Error).message}`, hora: ahora() });
  } finally {
    exportando.value = false;
  }
}

// --- La voz: lo dicho aparece en la burbuja mientras hablas y la pregunta sale sola al callarte ---
const voz = usarVoz((dicho) => void preguntar(dicho, true), props.voz);

const textoEnVivo = computed(() => {
  if (voz.estado.value === 'abriendo') return 'Abriendo el micrófono…';
  if (voz.parcial.value) return voz.parcial.value;
  return voz.estado.value === 'transcribiendo' ? 'Entendiendo lo que dijiste…' : 'Te escucho…';
});

// Siempre a la vista lo último del hilo
watch(
  () => [conv.mensajes.length, pensando.value, voz.estado.value, voz.parcial.value],
  () => void nextTick(() => hilo.value?.scrollTo?.({ top: hilo.value.scrollHeight, behavior: 'smooth' })),
);

const alPerderSenal = () => (sinSenal.value = true);
onMounted(() => {
  window.addEventListener('online', responderPendientes);
  window.addEventListener('offline', alPerderSenal);
  // Preguntas que quedaron esperando en otra visita: se ven en el hilo con su reloj
  for (const pregunta of preguntasPendientes(orgId)) {
    const igual = normalizarPregunta(pregunta);
    if (!conv.mensajes.some((m) => m.de === 'tu' && m.estado === 'espera-senal' && normalizarPregunta(m.texto) === igual)) {
      agregar({ id: nuevoId(), de: 'tu', texto: pregunta, hora: ahora(), estado: 'espera-senal' });
    }
  }
  if (preguntasPendientes(orgId).length && navigator.onLine !== false) void responderPendientes();
  hilo.value?.scrollTo?.({ top: hilo.value.scrollHeight });
});
onUnmounted(() => {
  window.removeEventListener('online', responderPendientes);
  window.removeEventListener('offline', alPerderSenal);
});
</script>

<template>
  <div class="cabecera">
    <h1 class="titulo-pantalla">Reportes e inteligencia</h1>
  </div>

  <div class="rp">
    <!-- ======== El chat ======== -->
    <section class="rp-chat" aria-label="Conversación con el Analista">
      <header class="rp-chat-cabecera">
        <span class="rp-avatar"><Icono nombre="chispa" :tamano="18" /></span>
        <div class="rp-quien">
          <strong>Analista de Abasto</strong>
          <small>Pregúntale por escrito o con tu voz</small>
        </div>
        <button v-if="conv.mensajes.length" class="rp-boton-chico" @click="nuevaConversacion">
          <Icono nombre="nueva" :tamano="15" />Nueva
        </button>
      </header>

      <p v-if="sinSenal" class="rp-sin-senal" role="status">
        <Icono nombre="aviso" :tamano="15" />Sin señal: lo que preguntes espera aquí y se responde solo al volver.
      </p>

      <div ref="hilo" class="rp-hilo" aria-live="polite">
        <div class="rp-fila analista">
          <span class="rp-avatar chico"><Icono nombre="chispa" :tamano="14" /></span>
          <div class="rp-globo">
            <p>Hola, {{ nombre }}. Pregúntame lo que quieras de tu negocio y lo armo en la mesa de la derecha.</p>
            <div v-if="!conv.mensajes.length" class="rp-chips">
              <button v-for="s in SUGERENCIAS" :key="s.pregunta" class="rp-chip" @click="preguntar(s.pregunta)">{{ s.pregunta }}</button>
            </div>
          </div>
        </div>

        <template v-for="m in conv.mensajes" :key="m.id">
          <div v-if="m.de === 'tu'" class="rp-fila tu">
            <div class="rp-burbuja" :class="{ espera: m.estado === 'espera-senal' }">
              <p>{{ m.texto }}</p>
              <span class="rp-meta">
                <Icono v-if="m.porVoz" nombre="microfono" :tamano="12" />
                {{ horaCorta(m.hora) }}
                <template v-if="m.estado === 'espera-senal'"><Icono nombre="reloj" :tamano="13" /> Espera señal</template>
                <Icono v-else-if="m.estado === 'respondida'" nombre="visto" :tamano="14" class="rp-visto" />
                <Icono v-else nombre="reloj" :tamano="13" />
              </span>
            </div>
          </div>

          <div v-else class="rp-fila analista">
            <span class="rp-avatar chico"><Icono nombre="chispa" :tamano="14" /></span>
            <div class="rp-globo" :class="m.tipo">
              <p>{{ m.texto }}</p>
              <template v-if="m.tipo === 'reporte'">
                <button
                  v-if="enLaMesa(m.reporteId)"
                  class="rp-tarjeta"
                  :class="{ activa: conv.activa === m.reporteId }"
                  @click="verEnLaMesa(m.reporteId)"
                >
                  <Icono :nombre="iconoDe(reporteDe(m.reporteId) as Reporte)" :tamano="16" />
                  <span>{{ tituloCorto(reporteDe(m.reporteId)?.pregunta ?? '', 40) }}</span>
                  <small>{{ conv.activa === m.reporteId ? 'En la mesa' : 'Ver en la mesa' }}</small>
                </button>
                <small v-else class="rp-cerrado">Cerraste este reporte.</small>
              </template>
              <div v-if="m.tipo === 'aclaracion'" class="rp-chips">
                <button v-for="o in m.opciones" :key="o" class="rp-chip" :disabled="pensando" @click="preguntar(o)">{{ o }}</button>
              </div>
            </div>
          </div>
        </template>

        <!-- Mientras hablas: tu burbuja con lo que Whisper va entendiendo -->
        <div v-if="voz.escuchando.value" class="rp-fila tu">
          <div class="rp-burbuja en-vivo" :class="voz.estado.value" role="status">
            <span class="rp-ondas" :style="{ '--nivel': voz.nivel.value }" aria-hidden="true"><i /><i /><i /><i /><i /></span>
            <p>{{ textoEnVivo }}</p>
          </div>
        </div>

        <div v-if="pensando" class="rp-fila analista">
          <span class="rp-avatar chico"><Icono nombre="chispa" :tamano="14" /></span>
          <div class="rp-globo pensando" role="status">
            <span class="rp-puntos" aria-hidden="true"><i /><i /><i /></span>
            Armando el reporte…
          </div>
        </div>
      </div>

      <p v-if="voz.error.value" class="rp-error-voz">{{ voz.error.value }}</p>

      <form class="rp-compositor" @submit.prevent="preguntar()">
        <!-- La voz se transcribe con Whisper dentro del navegador: el audio no sale del equipo -->
        <button
          type="button"
          class="rp-microfono"
          :class="voz.estado.value"
          :disabled="voz.estado.value === 'abriendo' || voz.estado.value === 'transcribiendo' || pensando"
          :aria-label="voz.estado.value === 'escuchando' ? 'Listo, ya terminé' : 'Hablar'"
          :aria-pressed="voz.estado.value === 'escuchando'"
          @click="voz.alternar"
        >
          <Icono :nombre="voz.estado.value === 'escuchando' ? 'listo' : 'microfono'" :tamano="20" />
        </button>
        <template v-if="voz.escuchando.value">
          <span class="rp-escuchando">Se envía solo cuando terminas de hablar</span>
          <button type="button" class="rp-cancelar" aria-label="Cancelar" @click="voz.cancelar">
            <Icono nombre="cerrar" :tamano="18" />
          </button>
        </template>
        <template v-else>
          <input
            v-model="texto"
            class="rp-entrada"
            aria-label="Pregunta algo sobre tus datos"
            placeholder="Pregunta algo sobre tus datos…"
            maxlength="500"
          />
          <button class="rp-enviar" aria-label="Preguntar" :disabled="pensando || texto.trim().length < 3">
            <Icono nombre="enviar" :tamano="20" />
          </button>
        </template>
      </form>
    </section>

    <!-- ======== La mesa de trabajo ======== -->
    <section ref="mesa" class="rp-mesa" aria-label="Mesa de trabajo">
      <nav v-if="conv.reportes.length || armando" class="rp-pestanas" role="tablist">
        <div v-for="r in conv.reportes" :key="r.id" class="rp-pestana" :class="{ activa: r.id === conv.activa && !armando }">
          <button role="tab" :aria-selected="r.id === conv.activa" :aria-label="r.pregunta" :title="r.pregunta" @click="conv.activa = r.id">
            <Icono :nombre="iconoDe(r)" :tamano="15" />{{ tituloCorto(r.pregunta) }}
          </button>
          <button class="rp-cerrar" :aria-label="`Cerrar ${tituloCorto(r.pregunta)}`" @click="cerrarPestana(r.id)">
            <Icono nombre="cerrar" :tamano="13" />
          </button>
        </div>
        <div v-if="armando" class="rp-pestana activa armando">
          <button role="tab" aria-selected="true"><span class="rp-girando" aria-hidden="true" />{{ tituloCorto(armando) }}</button>
        </div>
      </nav>

      <div class="rp-mesa-cuerpo">
        <div v-if="armando" class="rp-armando" aria-label="Armando el reporte">
          <h2>{{ armando }}</h2>
          <p class="gris">El Analista arma la consulta, la revisa y lee tus datos…</p>
          <div class="rp-esqueleto numeros"><i /><i /><i /></div>
          <div class="rp-esqueleto barras"><i /><i /><i /><i /><i /></div>
        </div>

        <MesaDeReporte
          v-else-if="activo"
          :key="activo.id"
          :reporte="activo"
          :sin-senal="sinSenal"
          :exportando="exportando"
          @excel="exportar"
          @repetir="preguntar($event)"
        />

        <div v-else class="rp-mesa-vacia">
          <h2>Mesa de trabajo</h2>
          <p>Pregunta en el chat y aquí se arma el reporte: los números, el gráfico y la tabla para Excel. Cada pregunta queda en su pestaña.</p>
          <div class="rp-plantillas">
            <button v-for="s in SUGERENCIAS" :key="s.pregunta" class="rp-plantilla" :disabled="pensando" @click="preguntar(s.pregunta)">
              <span class="rp-plantilla-icono"><Icono :nombre="ICONOS[s.plantilla]" :tamano="22" /></span>
              <strong>{{ s.titulo }}</strong>
              <small>{{ s.pregunta }}</small>
            </button>
          </div>
          <template v-if="guardados.length">
            <h3>Guardados en este equipo <span class="gris rp-en-linea">· se ven sin señal</span></h3>
            <div class="rp-guardados">
              <button v-for="g in guardados" :key="g.guardadoEn + g.pregunta" class="rp-chip" @click="abrirGuardado(g)">
                {{ g.pregunta }} <span class="gris rp-en-linea">· {{ cuandoSeGuardo(g.guardadoEn) }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
/* ---------- Distribución: chat a la izquierda, mesa de trabajo a la derecha ---------- */
.rp { display: grid; grid-template-columns: minmax(330px, 2fr) minmax(0, 3fr); gap: 1rem; height: max(560px, calc(100dvh - 250px)); }
.rp-chat, .rp-mesa {
  display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden;
  background: hsl(var(--superficie)); border: 1px solid hsl(var(--borde)); border-radius: var(--radio-xl); box-shadow: var(--sombra-carta);
}
@media (max-width: 1000px) {
  .rp { grid-template-columns: 1fr; height: auto; }
  .rp-chat { height: 72dvh; min-height: 460px; }
  .rp-mesa { min-height: 420px; scroll-margin-top: 1rem; }
}

.rp-boton-chico {
  display: inline-flex; align-items: center; gap: 0.35rem; height: 32px; padding: 0 0.75rem; font: inherit; font-weight: 600; cursor: pointer;
  border-radius: 999px; border: 1px solid hsl(var(--borde)); background: hsl(var(--superficie)); color: hsl(var(--texto-2));
}
.rp-boton-chico:hover:not(:disabled) { border-color: hsl(var(--borde-fuerte)); color: hsl(var(--texto)); }

/* ---------- Chat ---------- */
.rp-chat-cabecera { display: flex; align-items: center; gap: 0.7rem; padding: 0.85rem 1rem; border-bottom: 1px solid hsl(var(--borde)); }
.rp-quien { flex: 1; min-width: 0; display: grid; }
.rp-quien strong { font-family: var(--fuente-titulo); font-size: 0.9375rem; }
.rp-quien small { color: hsl(var(--texto-3)); }
.rp-avatar { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 12px; background: hsl(var(--tinta)); color: hsl(var(--primary)); }
.rp-avatar.chico { width: 28px; height: 28px; border-radius: 9px; margin-top: 2px; }
.rp-sin-senal { display: flex; align-items: center; gap: 0.4rem; margin: 0; padding: 0.5rem 1rem; background: hsl(var(--advertencia-suave)); color: hsl(var(--advertencia-suave-texto)); font-weight: 600; }

.rp-hilo { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: hsl(var(--tenue)); scrollbar-width: thin; }
.rp-fila { display: flex; gap: 0.5rem; align-items: flex-start; animation: rp-entrar 0.22s ease-out; }
.rp-fila.tu { justify-content: flex-end; }
@keyframes rp-entrar { from { opacity: 0; transform: translateY(6px); } }

.rp-globo { max-width: 88%; padding: 0.65rem 0.85rem; border-radius: 4px 16px 16px 16px; background: hsl(var(--superficie)); border: 1px solid hsl(var(--borde)); }
.rp-globo p { margin: 0; line-height: 1.45; }
.rp-globo.aclaracion p { font-weight: 600; }
.rp-globo.falla { background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); border-color: transparent; }
.rp-globo.aviso { background: hsl(var(--advertencia-suave)); color: hsl(var(--advertencia-suave-texto)); border-color: transparent; }
.rp-globo.pensando { display: flex; align-items: center; gap: 0.55rem; color: hsl(var(--texto-2)); }
.rp-cerrado { display: block; margin-top: 0.4rem; color: hsl(var(--texto-3)); }

.rp-burbuja { max-width: 82%; padding: 0.6rem 0.85rem 0.4rem; border-radius: 16px 16px 4px 16px; background: hsl(var(--tinta)); color: hsl(var(--tinta-texto)); }
.rp-burbuja p { margin: 0; line-height: 1.45; }
.rp-burbuja.espera { background: hsl(var(--tinta) / 0.75); }
.rp-meta { display: flex; justify-content: flex-end; align-items: center; gap: 0.25rem; margin-top: 0.2rem; font-size: 0.6875rem; opacity: 0.75; }
.rp-visto { color: hsl(var(--primary)); }

.rp-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem; }
.rp-chip {
  padding: 0.4rem 0.75rem; font: inherit; text-align: left; cursor: pointer; border-radius: 999px;
  border: 1px solid hsl(var(--borde)); background: hsl(var(--superficie)); color: hsl(var(--texto));
}
.rp-chip:hover:not(:disabled) { background: hsl(var(--primary-suave)); border-color: hsl(var(--primary-fuerte)); }

.rp-tarjeta {
  display: grid; grid-template-columns: auto 1fr; column-gap: 0.55rem; align-items: center; width: 100%; margin-top: 0.6rem;
  padding: 0.55rem 0.7rem; font: inherit; text-align: left; cursor: pointer;
  border-radius: 12px; border: 1px solid hsl(var(--borde)); background: hsl(var(--tenue)); color: hsl(var(--texto));
}
.rp-tarjeta .icono { grid-row: span 2; padding: 6px; box-sizing: content-box; border-radius: 8px; background: hsl(var(--primary-suave)); color: hsl(var(--primary-suave-texto)); }
.rp-tarjeta span { font-weight: 700; }
.rp-tarjeta small { color: hsl(var(--texto-3)); }
.rp-tarjeta.activa { border-color: hsl(var(--primary-fuerte)); background: hsl(var(--primary-suave) / 0.55); }

/* La burbuja en vivo: ondas que siguen tu voz y el texto que Whisper va entendiendo */
.rp-burbuja.en-vivo { display: flex; align-items: center; gap: 0.6rem; padding-bottom: 0.6rem; }
.rp-burbuja.en-vivo p { font-style: italic; opacity: 0.9; }
.rp-burbuja.en-vivo.transcribiendo .rp-ondas i { animation-play-state: paused; }
.rp-ondas { display: inline-flex; align-items: center; gap: 3px; height: 22px; flex: none; }
.rp-ondas i {
  display: block; width: 3px; height: calc(30% + var(--nivel, 0) * 70%); border-radius: 3px; background: hsl(var(--primary));
  transition: height 0.08s;
  /* transform corre fuera del hilo principal: las ondas siguen moviéndose mientras Whisper transcribe */
  animation: rp-onda 0.9s ease-in-out infinite;
}
.rp-ondas i:nth-child(2) { animation-delay: -0.2s; }
.rp-ondas i:nth-child(3) { animation-delay: -0.45s; }
.rp-ondas i:nth-child(4) { animation-delay: -0.1s; }
.rp-ondas i:nth-child(5) { animation-delay: -0.6s; }
@keyframes rp-onda { 50% { transform: scaleY(0.45); } }

.rp-puntos { display: inline-flex; gap: 3px; }
.rp-puntos i { width: 6px; height: 6px; border-radius: 50%; background: hsl(var(--texto-3)); animation: rp-punto 1s infinite ease-in-out; }
.rp-puntos i:nth-child(2) { animation-delay: 0.15s; }
.rp-puntos i:nth-child(3) { animation-delay: 0.3s; }
@keyframes rp-punto { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }

.rp-error-voz { margin: 0; padding: 0.5rem 1rem; background: hsl(var(--error-suave)); color: hsl(var(--error-suave-texto)); }

.rp-compositor { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid hsl(var(--borde)); background: hsl(var(--superficie)); }
.rp-entrada { flex: 1; min-width: 0; height: 44px; padding: 0 1rem; font: inherit; font-size: 0.875rem; border-radius: 999px; border: 1px solid hsl(var(--borde)); background: hsl(var(--tenue)); color: hsl(var(--texto)); }
.rp-entrada:focus { outline: 2px solid hsl(var(--primary)); outline-offset: 1px; background: hsl(var(--superficie)); }
.rp-escuchando { flex: 1; color: hsl(var(--texto-2)); font-weight: 600; }
.rp-microfono, .rp-enviar, .rp-cancelar { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 50%; cursor: pointer; border: 0; }
.rp-microfono { background: hsl(var(--tinta)); color: hsl(var(--primary)); }
.rp-microfono.escuchando { background: hsl(var(--error-suave-texto)); color: #fff; box-shadow: 0 0 0 0 hsl(var(--error-suave-texto) / 0.5); animation: rp-latido 1.4s infinite; }
@keyframes rp-latido { 70% { box-shadow: 0 0 0 10px hsl(var(--error-suave-texto) / 0); } }
.rp-enviar { background: hsl(var(--primary)); color: hsl(var(--primary-texto)); box-shadow: var(--sombra-marca); }
.rp-enviar:disabled { box-shadow: none; }
.rp-cancelar { background: hsl(var(--tenue)); color: hsl(var(--texto-2)); border: 1px solid hsl(var(--borde)); }

/* ---------- Mesa de trabajo ---------- */
.rp-pestanas { display: flex; gap: 0.25rem; padding: 0.6rem 0.75rem 0; box-shadow: inset 0 -1px 0 hsl(var(--borde)); overflow: auto hidden; scrollbar-width: none; flex: none; }
.rp-pestana { display: flex; align-items: center; flex: none; max-width: 240px; border-radius: 12px 12px 0 0; border: 1px solid transparent; border-bottom: 0; color: hsl(var(--texto-2)); }
.rp-pestana button { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; padding: 0.55rem 0.4rem 0.55rem 0.75rem; font: inherit; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; border: 0; background: none; color: inherit; }
.rp-pestana .rp-cerrar { padding: 0.35rem; margin-right: 0.3rem; border-radius: 6px; opacity: 0.6; }
.rp-pestana .rp-cerrar:hover { opacity: 1; background: hsl(var(--tenue)); }
.rp-pestana.activa { background: hsl(var(--superficie)); border-color: hsl(var(--borde)); color: hsl(var(--texto)); box-shadow: inset 0 3px 0 hsl(var(--primary)); }
.rp-pestana.armando button { padding-right: 0.9rem; }
.rp-girando { width: 13px; height: 13px; border-radius: 50%; border: 2px solid hsl(var(--borde)); border-top-color: hsl(var(--primary-fuerte)); animation: rp-girar 0.8s linear infinite; }
@keyframes rp-girar { to { transform: rotate(1turn); } }

.rp-mesa-cuerpo { flex: 1; min-height: 0; overflow-y: auto; padding: 1.25rem; scrollbar-width: thin; }
.rp-reporte { animation: rp-entrar 0.25s ease-out; }
.rp-reporte-cabecera { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
.rp-reporte-cabecera h2 { margin: 0 0 0.25rem; font-family: var(--fuente-titulo); font-size: 1.125rem; letter-spacing: -0.01em; }
.rp-explicacion { margin: 0 0 0.25rem; color: hsl(var(--texto-2)); }
.rp-reporte-acciones { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.4rem; flex: none; }
.rp-excel { display: inline-flex; align-items: center; gap: 0.35rem; height: 32px; border-radius: 999px; }
.rp-sql { margin: 0 0 1rem; padding: 0.9rem 1rem; border-radius: var(--radio); background: hsl(var(--tinta)); color: hsl(var(--tinta-texto)); font-family: var(--fuente-mono, ui-monospace, monospace); font-size: 0.75rem; white-space: pre-wrap; }

.rp-numeros { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
.rp-numero { display: grid; gap: 0.2rem; padding: 1.1rem 1.2rem; border-radius: 18px; border: 1px solid hsl(var(--borde)); background: hsl(var(--tenue)); animation: rp-entrar 0.3s ease-out both; }
.rp-numero:nth-child(2) { animation-delay: 0.06s; }
.rp-numero:nth-child(3) { animation-delay: 0.12s; }
.rp-numero.principal { background: hsl(var(--tinta)); color: hsl(var(--tinta-texto)); border-color: transparent; }
.rp-numero-etiqueta { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.75; }
.rp-numero strong { font-family: var(--fuente-titulo); font-size: 1.9rem; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.rp-numero.principal strong { color: hsl(var(--primary)); }
.rp-numero-detalle { font-size: 0.75rem; opacity: 0.75; }

.rp-resumen { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1rem; }
.rp-dato { display: grid; min-width: 150px; padding: 0.6rem 0.9rem; border-radius: 14px; background: hsl(var(--tenue)); border: 1px solid hsl(var(--borde)); }
.rp-dato span { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: hsl(var(--texto-3)); }
.rp-dato strong { font-family: var(--fuente-titulo); font-size: 1.15rem; font-variant-numeric: tabular-nums; }
.rp-dato small { color: hsl(var(--texto-3)); }
.rp-lienzo { padding: 1rem 1rem 0.25rem; margin-bottom: 1rem; border-radius: 16px; border: 1px solid hsl(var(--borde)); }
.rp-lienzo .grafico .barra { transform-box: fill-box; transform-origin: left; animation: rp-crecer 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.rp-lienzo .grafico .linea { stroke-dasharray: 2000; animation: rp-trazar 0.9s ease-out both; }
@keyframes rp-crecer { from { transform: scaleX(0); } }
@keyframes rp-trazar { from { stroke-dashoffset: 2000; } to { stroke-dashoffset: 0; } }

.rp-tabla { overflow-x: auto; border-radius: 14px; border: 1px solid hsl(var(--borde)); }
.rp-tabla th.num { text-align: right; }
.rp-tabla tbody tr:hover td { background: hsl(var(--tenue)); }
.rp-recortado { margin-top: 0.5rem; }
.rp-sin-datos { display: flex; gap: 0.75rem; align-items: flex-start; padding: 1rem 1.1rem; border-radius: 14px; background: hsl(var(--advertencia-suave)); color: hsl(var(--advertencia-suave-texto)); }
.rp-sin-datos p { margin: 0.2rem 0 0; }

.rp-armando h2 { margin: 0 0 0.25rem; font-family: var(--fuente-titulo); font-size: 1.125rem; }
.rp-esqueleto { display: grid; gap: 0.6rem; margin-top: 1rem; }
.rp-esqueleto i { display: block; border-radius: 12px; background: linear-gradient(90deg, hsl(var(--tenue)) 25%, hsl(var(--borde)) 50%, hsl(var(--tenue)) 75%); background-size: 200% 100%; animation: rp-brillo 1.2s infinite linear; }
.rp-esqueleto.numeros { grid-template-columns: repeat(3, 1fr); }
.rp-esqueleto.numeros i { height: 84px; }
.rp-esqueleto.barras i { height: 22px; }
.rp-esqueleto.barras i:nth-child(1) { width: 92%; }
.rp-esqueleto.barras i:nth-child(2) { width: 74%; }
.rp-esqueleto.barras i:nth-child(3) { width: 61%; }
.rp-esqueleto.barras i:nth-child(4) { width: 45%; }
.rp-esqueleto.barras i:nth-child(5) { width: 30%; }
@keyframes rp-brillo { to { background-position: -200% 0; } }

.rp-mesa-vacia h2 { margin: 0.25rem 0 0.35rem; font-family: var(--fuente-titulo); font-size: 1.25rem; }
.rp-mesa-vacia > p { margin: 0 0 1.25rem; max-width: 560px; color: hsl(var(--texto-2)); line-height: 1.5; }
.rp-mesa-vacia h3 { margin: 1.5rem 0 0.6rem; font-family: var(--fuente-titulo); font-size: 0.9375rem; }
.rp-plantillas { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
.rp-plantilla {
  display: grid; justify-items: start; gap: 0.3rem; padding: 1rem; font: inherit; text-align: left; cursor: pointer;
  border-radius: 18px; border: 1px dashed hsl(var(--borde-fuerte)); background: hsl(var(--tenue)); color: hsl(var(--texto));
  transition: transform 0.15s, border-color 0.15s, background 0.15s;
}
.rp-plantilla:hover:not(:disabled) { transform: translateY(-2px); border-style: solid; border-color: hsl(var(--primary-fuerte)); background: hsl(var(--superficie)); }
.rp-plantilla-icono { display: grid; place-items: center; width: 42px; height: 42px; margin-bottom: 0.35rem; border-radius: 12px; background: hsl(var(--primary)); color: hsl(var(--primary-texto)); }
.rp-plantilla small { color: hsl(var(--texto-3)); }
.rp-guardados { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rp-en-linea { display: inline; }

@media (prefers-reduced-motion: reduce) {
  .rp *, .rp *::before { animation: none !important; transition: none !important; }
}
</style>
