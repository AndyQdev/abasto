/**
 * Plantillas de la primera receta (02/11, docs/plan-catalogo-real-y-plantillas.md). Al registrarse, el productor elige su
 * área y ve una receta ya llena que puede editar ahí mismo.
 *
 * LAS CANTIDADES SON UN PUNTO DE PARTIDA, NO UNA FÓRMULA COMPROBADA. Cada insumo dice de dónde sale:
 *   · F: publicada en la fuente (F1…F9 del plan) · A: escalada o ajustada desde la fuente · E: estimada, sin fuente.
 * La app no las presenta como comprobadas: «Ajústala a tu receta».
 *
 * El insumo es genérico («Harina de trigo») y trae los productos del catálogo de Abasto que lo venden, de la
 * presentación más chica a la más grande; quien pide elige cuál. Las cantidades van en kg, g, L, ml o u. El agua no
 * se compra: va sin productos y sin costo.
 */
import type { SubtipoProductor } from '../negocios';

export type Origen = 'F' | 'A' | 'E';
export type UnidadDePlantilla = 'kg' | 'g' | 'L' | 'ml' | 'u.';

/** Un insumo genérico y los códigos del catálogo de Abasto que lo venden (vacío: no se compra, como el agua) */
export interface InsumoGenerico {
  clave: string;
  nombre: string;
  codigos: string[];
}

export interface InsumoDePlantilla extends InsumoGenerico {
  cantidad: number;
  unidad: UnidadDePlantilla;
  origen: Origen;
  /** F1…F9 del plan */
  fuentes: string[];
  nota?: string;
}

export interface GrupoDePlantilla {
  /** «Para la masa», «Para el relleno» */
  titulo: string;
  insumos: InsumoDePlantilla[];
}

export interface PlantillaDeReceta {
  clave: string;
  area: SubtipoProductor;
  /** «Salteña de carne»: también es el nombre de lo que hace */
  nombre: string;
  rinde: number;
  /** Para decir «Salen 50 salteñas» y «Cada salteña te cuesta…» */
  unidad: { una: string; varias: string };
  grupos: GrupoDePlantilla[];
  nota?: string;
}

// Los insumos genéricos, con sus productos de Abasto de la presentación más chica a la más grande
const G = {
  harina: { clave: 'harina', nombre: 'Harina de trigo', codigos: ['AB-102', 'AB-101'] },
  azucar: { clave: 'azucar', nombre: 'Azúcar', codigos: ['AB-123', 'AB-103'] },
  manteca: { clave: 'manteca', nombre: 'Manteca', codigos: ['AB-130', 'AB-106'] },
  margarina: { clave: 'margarina', nombre: 'Margarina', codigos: ['AB-131'] },
  mantequilla: { clave: 'mantequilla', nombre: 'Mantequilla', codigos: ['AB-040', 'AB-175'] },
  aceite: { clave: 'aceite', nombre: 'Aceite', codigos: ['AB-107', 'AB-132'] },
  agua: { clave: 'agua', nombre: 'Agua', codigos: [] },
  huevo: { clave: 'huevo', nombre: 'Huevo', codigos: ['AB-115'] },
  sal: { clave: 'sal', nombre: 'Sal', codigos: ['AB-007', 'AB-135'] },
  urucu: { clave: 'urucu', nombre: 'Urucú', codigos: ['AB-136'] },
  carne: { clave: 'carne', nombre: 'Carne de res', codigos: ['AB-154'] },
  carneMolida: { clave: 'carne-molida', nombre: 'Carne molida', codigos: ['AB-155'] },
  lomo: { clave: 'lomo', nombre: 'Lomo de res', codigos: ['AB-156'] },
  corazon: { clave: 'corazon', nombre: 'Corazón de res', codigos: ['AB-157'] },
  charque: { clave: 'charque', nombre: 'Charque', codigos: ['AB-153'] },
  pollo: { clave: 'pollo', nombre: 'Pollo entero', codigos: ['AB-158'] },
  gallina: { clave: 'gallina', nombre: 'Gallina criolla', codigos: ['AB-160'] },
  patas: { clave: 'patas', nombre: 'Patas de pollo', codigos: ['AB-159'] },
  chorizo: { clave: 'chorizo', nombre: 'Chorizo', codigos: ['AB-161'] },
  salchicha: { clave: 'salchicha', nombre: 'Salchicha Viena', codigos: ['AB-162'] },
  papa: { clave: 'papa', nombre: 'Papa', codigos: ['AB-116'] },
  cebolla: { clave: 'cebolla', nombre: 'Cebolla', codigos: ['AB-117'] },
  ajo: { clave: 'ajo', nombre: 'Ajo', codigos: ['AB-118'] },
  ajoEnPolvo: { clave: 'ajo-en-polvo', nombre: 'Ajo en polvo', codigos: ['AB-137'] },
  tomate: { clave: 'tomate', nombre: 'Tomate', codigos: ['AB-145'] },
  zanahoria: { clave: 'zanahoria', nombre: 'Zanahoria', codigos: ['AB-146'] },
  pimenton: { clave: 'pimenton', nombre: 'Pimentón', codigos: ['AB-147'] },
  locoto: { clave: 'locoto', nombre: 'Locoto', codigos: ['AB-148'] },
  yuca: { clave: 'yuca', nombre: 'Yuca', codigos: ['AB-149'] },
  platanoVerde: { clave: 'platano-verde', nombre: 'Plátano verde', codigos: ['AB-150'] },
  platanoMaduro: { clave: 'platano-maduro', nombre: 'Plátano maduro', codigos: ['AB-151'] },
  lechuga: { clave: 'lechuga', nombre: 'Lechuga', codigos: ['AB-152'] },
  arveja: { clave: 'arveja', nombre: 'Arveja seca', codigos: ['AB-134'] },
  mani: { clave: 'mani', nombre: 'Maní crudo', codigos: ['AB-133'] },
  arroz: { clave: 'arroz', nombre: 'Arroz', codigos: ['AB-109', 'AB-108'] },
  fideo: { clave: 'fideo', nombre: 'Fideo', codigos: ['AB-110'] },
  aji: { clave: 'aji', nombre: 'Ají colorado molido', codigos: ['AB-111'] },
  comino: { clave: 'comino', nombre: 'Comino', codigos: ['AB-112'] },
  pimienta: { clave: 'pimienta', nombre: 'Pimienta', codigos: ['AB-113'] },
  oregano: { clave: 'oregano', nombre: 'Orégano', codigos: ['AB-114'] },
  vinagre: { clave: 'vinagre', nombre: 'Vinagre', codigos: ['AB-138'] },
  gelatina: { clave: 'gelatina', nombre: 'Gelatina sin sabor', codigos: ['AB-129'] },
  aceitunas: { clave: 'aceitunas', nombre: 'Aceitunas', codigos: ['AB-139'] },
  pasas: { clave: 'pasas', nombre: 'Pasas de uva', codigos: ['AB-140'] },
  queso: { clave: 'queso', nombre: 'Queso criollo', codigos: ['AB-144'] },
  leche: { clave: 'leche', nombre: 'Leche', codigos: ['AB-017'] },
  polvoDeHornear: { clave: 'polvo-de-hornear', nombre: 'Polvo de hornear', codigos: ['AB-105'] },
  levadura: { clave: 'levadura', nombre: 'Levadura seca', codigos: ['AB-104'] },
  vainilla: { clave: 'vainilla', nombre: 'Esencia de vainilla', codigos: ['AB-128'] },
  almidon: { clave: 'almidon', nombre: 'Almidón de yuca', codigos: ['AB-125', 'AB-124'] },
  maicena: { clave: 'maicena', nombre: 'Maicena', codigos: ['AB-126'] },
  panMolido: { clave: 'pan-molido', nombre: 'Pan molido', codigos: ['AB-127'] },
  panDeHamburguesa: { clave: 'pan-de-hamburguesa', nombre: 'Pan de hamburguesa', codigos: ['AB-163'] },
  mayonesa: { clave: 'mayonesa', nombre: 'Mayonesa', codigos: ['AB-141'] },
  ketchup: { clave: 'ketchup', nombre: 'Kétchup', codigos: ['AB-142'] },
  mostaza: { clave: 'mostaza', nombre: 'Mostaza', codigos: ['AB-143'] },
  palitos: { clave: 'palitos', nombre: 'Palitos de anticucho', codigos: ['AB-164'] },
} satisfies Record<string, InsumoGenerico>;

/** Insumo de plantilla: «i(G.harina, 2, 'kg', 'F1')», «i(G.azucar, 400, 'g', 'A', 'Las fuentes van de 300 a 500 g')» */
function i(g: InsumoGenerico, cantidad: number, unidad: UnidadDePlantilla, etiqueta: string, nota?: string): InsumoDePlantilla {
  const partes = etiqueta.split(/[,\s]+/).filter(Boolean);
  const origen = (partes[0].startsWith('F') ? 'F' : partes[0]) as Origen;
  return { ...g, cantidad, unidad, origen, fuentes: partes.filter((p) => /^F\d$/.test(p)), ...(nota ? { nota } : {}) };
}

const un = (una: string, varias: string) => ({ una, varias });
const PLATO = un('plato', 'platos');
const PORCION = un('porción', 'porciones');

// La masa de la salteña [F1: 2 kg de harina, ~50 bollos de 90 g] y su relleno de adentro; la variante cambia la carne
const MASA_DE_SALTENA: GrupoDePlantilla = {
  titulo: 'Para la masa',
  insumos: [
    i(G.harina, 2, 'kg', 'F1'),
    i(G.manteca, 460, 'g', 'F1'),
    i(G.azucar, 400, 'g', 'A', 'Las fuentes van de 300 a 500 g'),
    i(G.agua, 700, 'ml', 'A'),
    i(G.huevo, 4, 'u.', 'A'),
    i(G.sal, 30, 'g', 'F1'),
    i(G.urucu, 30, 'g', 'F1'),
  ],
};
const jigote = (proteina: InsumoDePlantilla): GrupoDePlantilla => ({
  titulo: 'Para el jigote',
  insumos: [
    proteina,
    i(G.papa, 1, 'kg', 'E'),
    i(G.cebolla, 1, 'kg', 'E'),
    i(G.arveja, 250, 'g', 'E'),
    i(G.aji, 150, 'g', 'E'),
    i(G.gelatina, 40, 'g', 'F1'),
    i(G.agua, 2, 'L', 'F1', 'El caldo'),
    i(G.comino, 10, 'g', 'E'),
    i(G.pimienta, 10, 'g', 'E'),
    i(G.oregano, 10, 'g', 'E'),
    i(G.ajo, 50, 'g', 'E'),
    i(G.sal, 30, 'g', 'E'),
    i(G.aceite, 100, 'ml', 'E'),
  ],
});
const ADENTRO_DE_SALTENA: GrupoDePlantilla = {
  titulo: 'Para adentro',
  insumos: [i(G.huevo, 8, 'u.', 'F1', 'Huevo duro'), i(G.aceitunas, 250, 'g', 'F1', 'Unas 50 aceitunas'), i(G.pasas, 200, 'g', 'A, F2')],
};
// El acompañamiento de los platos cruceños con carne (keperí, rapi) y del pacumuto
const acompanamiento = (origen: string): GrupoDePlantilla => ({
  titulo: 'Para acompañar',
  insumos: [i(G.arroz, 1.5, 'kg', origen), i(G.queso, 500, 'g', origen), i(G.yuca, 3, 'kg', origen)],
});

export const PLANTILLAS: PlantillaDeReceta[] = [
  // Salteñería y empanadas
  {
    clave: 'saltena-carne',
    area: 'salteneria',
    nombre: 'Salteña de carne',
    rinde: 50,
    unidad: un('salteña', 'salteñas'),
    nota: 'Bollos de unos 90 g',
    grupos: [MASA_DE_SALTENA, jigote(i(G.carne, 2, 'kg', 'A')), ADENTRO_DE_SALTENA],
  },
  {
    clave: 'saltena-pollo',
    area: 'salteneria',
    nombre: 'Salteña de pollo',
    rinde: 50,
    unidad: un('salteña', 'salteñas'),
    grupos: [MASA_DE_SALTENA, jigote(i(G.pollo, 3, 'u.', 'E')), ADENTRO_DE_SALTENA],
  },
  {
    clave: 'empanada-queso',
    area: 'salteneria',
    nombre: 'Empanada de queso',
    rinde: 50,
    unidad: un('empanada', 'empanadas'),
    grupos: [
      {
        titulo: 'Para la masa',
        insumos: [
          i(G.harina, 2, 'kg', 'E'),
          i(G.manteca, 400, 'g', 'E'),
          i(G.azucar, 100, 'g', 'E'),
          i(G.polvoDeHornear, 20, 'g', 'E'),
          i(G.huevo, 3, 'u.', 'E'),
          i(G.sal, 30, 'g', 'E'),
          i(G.agua, 700, 'ml', 'E'),
        ],
      },
      { titulo: 'Para el relleno', insumos: [i(G.queso, 1.5, 'kg', 'E')] },
    ],
  },
  // Panadería y pastelería
  {
    clave: 'pan-batido',
    area: 'panaderia',
    nombre: 'Pan batido',
    rinde: 300,
    unidad: un('pan', 'panes'),
    nota: 'Con 1 arroba de harina. La fuente es chilena y no lleva manteca; unos 60 g por pan',
    grupos: [
      {
        titulo: 'Para la masa',
        insumos: [
          i(G.harina, 11.5, 'kg', 'A, F3'),
          i(G.agua, 6.9, 'L', 'A, F3'),
          i(G.sal, 230, 'g', 'A, F3'),
          i(G.levadura, 170, 'g', 'A, F3'),
          i(G.manteca, 230, 'g', 'E'),
        ],
      },
    ],
  },
  {
    clave: 'queque',
    area: 'panaderia',
    nombre: 'Queque',
    rinde: 40,
    unidad: PORCION,
    grupos: [
      {
        titulo: 'Para la masa',
        insumos: [
          i(G.harina, 1, 'kg', 'E'),
          i(G.azucar, 1, 'kg', 'E'),
          i(G.margarina, 1, 'kg', 'E'),
          i(G.huevo, 18, 'u.', 'E'),
          i(G.polvoDeHornear, 30, 'g', 'E'),
          i(G.leche, 200, 'ml', 'E'),
          i(G.vainilla, 20, 'ml', 'E'),
        ],
      },
    ],
  },
  // Horneados cruceños
  {
    clave: 'cunape',
    area: 'horneados',
    nombre: 'Cuñapé',
    rinde: 50,
    unidad: un('cuñapé', 'cuñapés'),
    grupos: [
      {
        titulo: 'Para la masa',
        insumos: [
          i(G.almidon, 1.1, 'kg', 'A, F4'),
          i(G.queso, 1.1, 'kg', 'A, F4, F5'),
          i(G.huevo, 4, 'u.', 'A, F4'),
          i(G.mantequilla, 90, 'g', 'A, F4'),
          i(G.sal, 30, 'g', 'A', 'Ajústala según lo salado del queso'),
          i(G.leche, 550, 'ml', 'A, F4'),
        ],
      },
    ],
  },
  {
    clave: 'sonso',
    area: 'horneados',
    nombre: 'Sonso',
    rinde: 20,
    unidad: PORCION,
    grupos: [
      {
        titulo: 'Para la masa',
        insumos: [i(G.yuca, 2.5, 'kg', 'E'), i(G.queso, 800, 'g', 'E'), i(G.manteca, 120, 'g', 'E'), i(G.leche, 200, 'ml', 'E'), i(G.sal, 20, 'g', 'E')],
      },
    ],
  },
  {
    clave: 'masaco',
    area: 'horneados',
    nombre: 'Masaco de plátano',
    rinde: 20,
    unidad: PORCION,
    grupos: [
      {
        titulo: 'Para el masaco',
        insumos: [
          i(G.platanoVerde, 12, 'u.', 'E', 'Unos 3 kg'),
          i(G.charque, 500, 'g', 'E'),
          i(G.manteca, 200, 'g', 'E'),
          i(G.sal, 20, 'g', 'E'),
        ],
      },
    ],
  },
  // Pensión y restaurante: cada plato rinde 20
  {
    clave: 'majadito',
    area: 'pension',
    nombre: 'Majadito',
    rinde: 20,
    unidad: PLATO,
    grupos: [
      {
        titulo: 'Para el majadito',
        insumos: [
          i(G.charque, 2, 'kg', 'A, F5, F6'),
          i(G.arroz, 2, 'kg', 'A, F6'),
          i(G.aceite, 400, 'ml', 'A, F5'),
          i(G.cebolla, 1, 'kg', 'A'),
          i(G.pimenton, 500, 'g', 'A'),
          i(G.tomate, 1, 'kg', 'A'),
          i(G.ajo, 60, 'g', 'A'),
          i(G.urucu, 30, 'g', 'A, F5'),
          i(G.sal, 40, 'g', 'E'),
          i(G.pimienta, 10, 'g', 'E'),
          i(G.agua, 6, 'L', 'A'),
        ],
      },
      { titulo: 'Para servir', insumos: [i(G.platanoMaduro, 10, 'u.', 'A', 'Frito'), i(G.huevo, 20, 'u.', 'A, F5', 'Frito')] },
    ],
  },
  {
    clave: 'sopa-de-mani',
    area: 'pension',
    nombre: 'Sopa de maní',
    rinde: 20,
    unidad: PLATO,
    grupos: [
      {
        titulo: 'Para la sopa',
        insumos: [
          i(G.mani, 400, 'g', 'A, F7, F8'),
          i(G.patas, 1, 'kg', 'A, F7', 'Unas 20 patas'),
          i(G.carne, 1.5, 'kg', 'A, F7'),
          i(G.cebolla, 600, 'g', 'A'),
          i(G.zanahoria, 1, 'kg', 'A, F7'),
          i(G.pimenton, 300, 'g', 'A'),
          i(G.fideo, 400, 'g', 'A, F7'),
          i(G.oregano, 15, 'g', 'A, F7'),
          i(G.pimienta, 10, 'g', 'A'),
          i(G.ajo, 30, 'g', 'A'),
          i(G.sal, 40, 'g', 'A'),
          i(G.agua, 10, 'L', 'A, F7'),
        ],
      },
      { titulo: 'Para las papas fritas', insumos: [i(G.papa, 3, 'kg', 'A, F8'), i(G.aceite, 1, 'L', 'A', 'Para freír')] },
    ],
  },
  {
    clave: 'locro',
    area: 'pension',
    nombre: 'Locro de gallina',
    rinde: 20,
    unidad: PLATO,
    grupos: [
      {
        titulo: 'Para el locro',
        insumos: [
          i(G.gallina, 3, 'u.', 'A, F5'),
          i(G.arroz, 1, 'kg', 'A, F5'),
          i(G.papa, 2, 'kg', 'A, F5'),
          i(G.aceite, 150, 'ml', 'A, F5'),
          i(G.cebolla, 500, 'g', 'E'),
          i(G.pimenton, 300, 'g', 'E'),
          i(G.urucu, 15, 'g', 'E'),
          i(G.huevo, 20, 'u.', 'E'),
          i(G.sal, 40, 'g', 'E'),
          i(G.agua, 15, 'L', 'A, F5'),
        ],
      },
    ],
  },
  {
    clave: 'keperi',
    area: 'pension',
    nombre: 'Keperí',
    rinde: 20,
    unidad: PLATO,
    grupos: [
      {
        titulo: 'Para el keperí',
        insumos: [
          i(G.carne, 5, 'kg', 'E'),
          i(G.cebolla, 1, 'kg', 'E'),
          i(G.ajo, 60, 'g', 'E'),
          i(G.aji, 100, 'g', 'E'),
          i(G.comino, 20, 'g', 'E'),
          i(G.vinagre, 200, 'ml', 'E'),
          i(G.aceite, 200, 'ml', 'E'),
          i(G.sal, 50, 'g', 'E'),
        ],
      },
      acompanamiento('E'),
    ],
  },
  {
    clave: 'rapi',
    area: 'pension',
    nombre: 'Rapi al jugo',
    rinde: 20,
    unidad: PLATO,
    grupos: [
      {
        titulo: 'Para el rapi',
        insumos: [
          i(G.carne, 5, 'kg', 'A, F5'),
          i(G.cebolla, 2, 'kg', 'A, F5'),
          i(G.tomate, 5, 'kg', 'A, F5'),
          i(G.pimenton, 1, 'kg', 'A, F5'),
          i(G.zanahoria, 1.5, 'kg', 'A, F5'),
          i(G.ajo, 60, 'g', 'A, F5'),
          i(G.aceite, 200, 'ml', 'E'),
          i(G.urucu, 15, 'g', 'E'),
          i(G.comino, 15, 'g', 'E'),
          i(G.pimienta, 10, 'g', 'E'),
          i(G.sal, 50, 'g', 'E'),
        ],
      },
      acompanamiento('E'),
    ],
  },
  {
    clave: 'pique-macho',
    area: 'pension',
    nombre: 'Pique macho',
    rinde: 20,
    unidad: PLATO,
    nota: 'No está en el estudio del ICE; entra por criterio propio',
    grupos: [
      {
        titulo: 'Para el pique',
        insumos: [
          i(G.lomo, 3.3, 'kg', 'A, F9'),
          i(G.chorizo, 1, 'kg', 'A, F9'),
          i(G.salchicha, 1, 'kg', 'A, F9'),
          i(G.cebolla, 1.3, 'kg', 'A, F9'),
          i(G.tomate, 1, 'kg', 'A, F9'),
          i(G.huevo, 7, 'u.', 'A, F9', 'Huevo duro'),
          i(G.locoto, 300, 'g', 'A, F9', 'Unos 7 locotos'),
          i(G.sal, 40, 'g', 'E'),
          i(G.pimienta, 10, 'g', 'E'),
        ],
      },
      { titulo: 'Para las papas fritas', insumos: [i(G.papa, 3.3, 'kg', 'A, F9'), i(G.aceite, 2, 'L', 'A', 'Para freír')] },
    ],
  },
  // Pollería y comida rápida: sin receta boliviana publicada, todo estimado
  {
    clave: 'pollo-frito',
    area: 'polleria',
    nombre: 'Pollo frito',
    rinde: 40,
    unidad: PORCION,
    grupos: [
      {
        titulo: 'Para el pollo',
        insumos: [
          i(G.pollo, 10, 'u.', 'E'),
          i(G.harina, 2, 'kg', 'E'),
          i(G.maicena, 500, 'g', 'E'),
          i(G.huevo, 12, 'u.', 'E'),
          i(G.leche, 1, 'L', 'E'),
          i(G.sal, 200, 'g', 'E'),
          i(G.pimienta, 30, 'g', 'E'),
          i(G.comino, 30, 'g', 'E'),
          i(G.ajoEnPolvo, 50, 'g', 'E'),
          i(G.aceite, 10, 'L', 'E', 'Para freír'),
        ],
      },
      { titulo: 'Para acompañar', insumos: [i(G.papa, 11.5, 'kg', 'E'), i(G.arroz, 3, 'kg', 'E')] },
    ],
  },
  {
    clave: 'hamburguesa',
    area: 'polleria',
    nombre: 'Hamburguesa',
    rinde: 50,
    unidad: un('hamburguesa', 'hamburguesas'),
    grupos: [
      {
        titulo: 'Para la carne',
        insumos: [
          i(G.carneMolida, 5, 'kg', 'E'),
          i(G.cebolla, 1, 'kg', 'E'),
          i(G.huevo, 10, 'u.', 'E'),
          i(G.panMolido, 300, 'g', 'E'),
          i(G.sal, 60, 'g', 'E'),
          i(G.pimienta, 15, 'g', 'E'),
        ],
      },
      {
        titulo: 'Para armarla',
        insumos: [
          i(G.panDeHamburguesa, 50, 'u.', 'E'),
          i(G.tomate, 2, 'kg', 'E'),
          i(G.lechuga, 6, 'u.', 'E'),
          i(G.mayonesa, 500, 'g', 'E'),
          i(G.ketchup, 500, 'g', 'E'),
          i(G.mostaza, 200, 'g', 'E'),
        ],
      },
    ],
  },
  {
    clave: 'salchipapa',
    area: 'polleria',
    nombre: 'Salchipapa',
    rinde: 20,
    unidad: PORCION,
    grupos: [
      {
        titulo: 'Para la salchipapa',
        insumos: [
          i(G.papa, 6, 'kg', 'E'),
          i(G.salchicha, 3, 'kg', 'E'),
          i(G.aceite, 3, 'L', 'E', 'Para freír'),
          i(G.sal, 40, 'g', 'E'),
          i(G.mayonesa, 300, 'g', 'E'),
          i(G.ketchup, 300, 'g', 'E'),
        ],
      },
    ],
  },
  // Puesto de comida
  {
    clave: 'anticucho',
    area: 'puesto',
    nombre: 'Anticucho',
    rinde: 30,
    unidad: un('palito', 'palitos'),
    grupos: [
      {
        titulo: 'Para los palitos',
        insumos: [
          i(G.corazon, 5, 'kg', 'E'),
          i(G.aji, 300, 'g', 'E'),
          i(G.comino, 20, 'g', 'E'),
          i(G.ajo, 100, 'g', 'E'),
          i(G.vinagre, 300, 'ml', 'E'),
          i(G.aceite, 300, 'ml', 'E'),
          i(G.sal, 50, 'g', 'E'),
          i(G.palitos, 30, 'u.', 'E'),
        ],
      },
      { titulo: 'Para acompañar', insumos: [i(G.papa, 3, 'kg', 'E')] },
    ],
  },
  {
    clave: 'asadito',
    area: 'puesto',
    nombre: 'Asadito con yuca',
    rinde: 40,
    unidad: un('asadito', 'asaditos'),
    nota: 'Base de la fuente: 500 g de carne y 500 g de yuca rallada; el rinde es estimado',
    grupos: [
      {
        titulo: 'Para el asadito',
        insumos: [
          i(G.carneMolida, 2.5, 'kg', 'A, F5'),
          i(G.yuca, 2.5, 'kg', 'A, F5', 'Rallada'),
          i(G.huevo, 5, 'u.', 'A, F5'),
          i(G.cebolla, 500, 'g', 'A, F5'),
          i(G.ajo, 25, 'g', 'A, F5'),
          i(G.panMolido, 300, 'g', 'A, F5'),
          i(G.sal, 40, 'g', 'E'),
          i(G.pimienta, 10, 'g', 'E'),
          i(G.aceite, 3, 'L', 'E', 'Para freír'),
        ],
      },
      { titulo: 'Para servir', insumos: [i(G.yuca, 3, 'kg', 'E', 'Sancochada')] },
    ],
  },
  {
    clave: 'pacumuto',
    area: 'puesto',
    nombre: 'Pacumuto',
    rinde: 20,
    unidad: PORCION,
    grupos: [
      {
        titulo: 'Para la carne',
        insumos: [i(G.carne, 5, 'kg', 'E'), i(G.comino, 20, 'g', 'E'), i(G.ajo, 60, 'g', 'E'), i(G.sal, 50, 'g', 'E'), i(G.aceite, 200, 'ml', 'E')],
      },
      {
        titulo: 'Para acompañar',
        insumos: [i(G.arroz, 1.5, 'kg', 'E'), i(G.queso, 500, 'g', 'E'), i(G.yuca, 3, 'kg', 'E'), i(G.cebolla, 500, 'g', 'E'), i(G.tomate, 500, 'g', 'E')],
      },
    ],
  },
];

/** Las plantillas de un área, en el orden en que se ofrecen («¿Qué preparas más?») */
export function plantillasDe(area: SubtipoProductor): PlantillaDeReceta[] {
  return PLANTILLAS.filter((p) => p.area === area);
}

/** Todos los insumos de la plantilla, sin grupos */
export function insumosDePlantilla(p: PlantillaDeReceta): InsumoDePlantilla[] {
  return p.grupos.flatMap((g) => g.insumos);
}

/** «Salen 50 salteñas» */
export function textoDeRinde(p: Pick<PlantillaDeReceta, 'unidad'>, rinde: number) {
  return `Salen ${rinde} ${rinde === 1 ? p.unidad.una : p.unidad.varias}`;
}

/**
 * «Arma tu primer estante» (tienda): lo que más se repone en una tienda de barrio, ya marcado. La tienda quita lo que
 * no vende y dice cuántas pide; la cantidad por defecto es la presentación por defecto del producto (la docena).
 */
export const ESTANTE_DE_TIENDA: string[] = [
  'AB-001', // arroz Caisy 1 kg
  'AB-002', // azúcar Guabirá 1 kg
  'AB-005', // aceite Fino 900 ml
  'AB-003', // fideo Don Vittorio 500 g
  'AB-004', // harina Famosa 1 kg
  'AB-007', // sal 1 kg
  'AB-115', // huevo (maple)
  'AB-017', // leche PIL
  'AB-018', // yogurt PIL
  'AB-014', // Coca-Cola 2 L
  'AB-016', // Simba 2 L
  'AB-015', // agua Vital 2 L
  'AB-025', // detergente Skip
  'AB-027', // lavandina
  'AB-041', // papel higiénico
  'AB-030', // jabón Protex
  'AB-021', // galletas Mabel's
  'AB-023', // chocolate Para Ti
  'AB-119', // bolsas plásticas
];
