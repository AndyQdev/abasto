import { defineCustomElement } from 'vue';
import Inteligencia from './Inteligencia.vue';

/**
 * Registra <abasto-inteligencia>. El Shell del Panel (React) importa este archivo y usa la etiqueta;
 * no sabe que adentro hay Vue. Los estilos quedan dentro del Shadow DOM del elemento.
 */
if (!customElements.get('abasto-inteligencia')) {
  customElements.define('abasto-inteligencia', defineCustomElement(Inteligencia));
}
