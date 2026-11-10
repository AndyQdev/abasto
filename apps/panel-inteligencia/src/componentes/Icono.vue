<script lang="ts">
export type NombreDeIcono =
  | 'microfono'
  | 'enviar'
  | 'cerrar'
  | 'listo'
  | 'codigo'
  | 'descargar'
  | 'barras'
  | 'linea'
  | 'tabla'
  | 'numeros'
  | 'aviso'
  | 'chispa'
  | 'reloj'
  | 'visto'
  | 'nueva'
  | 'recargar'
  | 'dona'
  | 'vista';
</script>

<script setup lang="ts">
/** Íconos de trazo, dibujados aquí para no sumar una librería al microfrontend. Toman el color del texto. */
defineProps<{ nombre: NombreDeIcono; tamano?: number }>();

const TRAZOS: Record<NombreDeIcono, string[]> = {
  microfono: ['M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z', 'M5.5 11a6.5 6.5 0 0 0 13 0', 'M12 17.5V21'],
  enviar: ['M12 19V5', 'M5.5 11.5 12 5l6.5 6.5'],
  cerrar: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  listo: ['M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z'],
  codigo: ['M8.5 8 4.5 12l4 4', 'M15.5 8l4 4-4 4'],
  descargar: ['M12 4v11', 'M7.5 10.5 12 15l4.5-4.5', 'M5 20h14'],
  barras: ['M4 20h16', 'M7 16v-4', 'M12 16V7', 'M17 16v-7'],
  linea: ['M4 19h16', 'M4.5 15.5l4.5-5 4 3 6.5-7.5'],
  tabla: ['M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 10h16', 'M10 10v9'],
  numeros: ['M5 9h14', 'M5 15h14', 'M10.5 4l-2 16', 'M15.5 4l-2 16'],
  aviso: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8v5', 'M12 16h.01'],
  chispa: ['M12 3.5l1.9 5 5.1 1.9-5.1 1.9-1.9 5-1.9-5L5 10.4l5.1-1.9z', 'M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'],
  reloj: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 8v4.5l3 1.8'],
  visto: ['M2.5 12.5l4 4 8-9', 'M11.5 15.5l1 1 8-9'],
  nueva: ['M12 5v14', 'M5 12h14'],
  recargar: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'],
  dona: ['M12 4a8 8 0 1 0 8 8', 'M12 4v4.5a3.5 3.5 0 1 0 3.5 3.5H20A8 8 0 0 0 12 4z'],
  vista: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
};
</script>

<template>
  <svg
    class="icono"
    :width="tamano ?? 18"
    :height="tamano ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="d in TRAZOS[nombre]" :key="d" :d="d" />
  </svg>
</template>
