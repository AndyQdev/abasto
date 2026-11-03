import { Component, Input, ViewEncapsulation } from '@angular/core';
import { ESTILOS_BASE } from '../estilos';
import { Icono } from '../icono';

/** Módulos que todavía no se construyen. Cada uno tiene su tarjeta en Trello. */
@Component({
  selector: 'abasto-vista-en-construccion',
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [Icono],
  styles: [
    ESTILOS_BASE,
    `
      .pronto { display: flex; align-items: center; gap: 1.5rem; padding: 2rem; max-width: 760px; }
      .pronto .disco { width: 84px; height: 84px; border-radius: 28px; }
      .pronto strong { display: block; font-size: 1.3rem; font-weight: 800; margin-bottom: 0.35rem; }
      .pronto p { margin: 0; color: hsl(var(--texto-2)); font-size: 1.05rem; }
    `,
  ],
  template: `
    <div class="cabecera"><h1 class="titulo-pantalla">{{ titulo }}</h1></div>
    <div class="carta pronto">
      <span class="disco lima"><abasto-icono nombre="herramienta" [tamano]="38" /></span>
      <div>
        <strong>Este módulo se construye en la fase {{ fase }}.</strong>
        <p>{{ detalle }}</p>
      </div>
    </div>
  `,
})
export class VistaEnConstruccion {
  @Input() titulo = '';
  @Input() fase = '';
  @Input() detalle = '';
}
