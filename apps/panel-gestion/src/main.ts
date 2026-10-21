import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { GestionRaiz } from './app/gestion';

/**
 * Este microfrontend no arranca una app en #root: registra el Web Component <abasto-gestion>.
 * El Shell del Panel (React) lo carga con import() y lo usa como cualquier etiqueta HTML.
 */
const app = await createApplication({
  providers: [provideZonelessChangeDetection(), provideBrowserGlobalErrorListeners()],
});

if (!customElements.get('abasto-gestion')) {
  customElements.define('abasto-gestion', createCustomElement(GestionRaiz, { injector: app.injector }));
}
