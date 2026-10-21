import { Component, Input, ViewEncapsulation } from '@angular/core';
import { ESTILOS_BASE } from '../estilos';

/** Módulos que todavía no se construyen. Cada uno tiene su tarjeta en Trello. */
@Component({
  selector: 'abasto-vista-en-construccion',
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: [ESTILOS_BASE],
  template: `
    <div class="cabecera"><h1 class="titulo-pantalla">{{ titulo }}</h1></div>
    <div class="carta">
      <p><strong>Este módulo se construye en la fase {{ fase }}.</strong></p>
      <p>{{ detalle }}</p>
      <p class="gris">La maqueta está en docs/uix-mockup/Abasto v1.html.</p>
    </div>
  `,
})
export class VistaEnConstruccion {
  @Input() titulo = '';
  @Input() fase = '';
  @Input() detalle = '';
}
