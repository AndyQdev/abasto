import type { Articulo, Producto } from '@abasto/comercio';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type KeyboardEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Tocable } from '../animacion';
import { Icono, Texto, type NombreDeIcono } from '../componentes';
import { ILUSTRACION, fotoDe, imagenDeRubro, type Imagen } from '../ilustraciones';
import { COLOR, FUENTE, SOMBRA } from '../tema';

/**
 * Las piezas que comparten las secciones de «Mi negocio» (Inventario, Vender, Fiado, El mes, Recetas, Cuentas y Mi
 * lista): campos, hojas que suben con el teclado, el selector de sección y las cifras grandes.
 */

/** «12,50» o «12.5» → 1250 centavos; NaN si no es un monto */
export function leerBs(texto: string) {
  const t = texto.trim().replace(/\s/g, '').replace(/^Bs/i, '').replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : NaN;
}

/** «Bs 12,50» → «12,50» para poner en un campo */
export const bsEnCampo = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');

/** «2», «1,5»: un número para poner en un campo */
export const enCampo = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

export const fecha = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** La foto del producto de Abasto si está en el catálogo; si no, la ilustración de su rubro */
export function imagenDeArticulo(a: Articulo, productos: Map<string, Producto>): Imagen {
  const p = a.productoId ? productos.get(a.productoId) : undefined;
  if (p) return fotoDe(p);
  if (a.clase === 'HECHO') return ILUSTRACION.negocioProductor;
  return a.rubro ? imagenDeRubro(a.rubro) : ILUSTRACION.inventarioVacio;
}

/**
 * Las hojas van en un Modal y ahí KeyboardAvoidingView no las sube: se mide el teclado y el contenido sube esa
 * misma altura, con el alto máximo recortado para que el botón siga a la vista.
 */
export function useTeclado() {
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (ev: KeyboardEvent) => setAlto(ev.endCoordinates.height));
    const ocultar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setAlto(0));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return alto;
}

/**
 * El contenido de una hoja: lo de arriba se desliza y `pie` (los botones) queda fijo abajo, siempre a la vista
 * (02/11, pedido de Andrés: «la mayoría no hace scroll y se asustan de no ver el botón»).
 */
export function ContenidoDeHoja({ children, pie, gap = 12 }: { children: ReactNode; pie?: ReactNode; gap?: number }) {
  const teclado = useTeclado();
  const { height } = useWindowDimensions();
  return (
    <View style={{ paddingBottom: teclado, flexShrink: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0, flexShrink: 1, maxHeight: Math.min(660, height - teclado - 120) }}
        contentContainerStyle={{ gap, paddingBottom: pie ? 6 : 0 }}
      >
        {children}
      </ScrollView>
      {pie && <View style={ui.pieDeHoja}>{pie}</View>}
    </View>
  );
}

/** Dos botones lado a lado en el pie: el secundario a la izquierda y el principal, más ancho, a la derecha */
export function DosBotones({ izquierda, derecha }: { izquierda?: ReactNode; derecha: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {izquierda && <View style={{ flex: 1 }}>{izquierda}</View>}
      <View style={{ flex: 1.4 }}>{derecha}</View>
    </View>
  );
}

export function Campo({
  etiqueta,
  valor,
  alCambiar,
  ejemplo,
  teclado = 'default',
  mayusculas,
  estilo,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (t: string) => void;
  ejemplo?: string;
  teclado?: 'default' | 'decimal-pad' | 'phone-pad';
  mayusculas?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: 4 }, estilo]}>
      <Texto v="chico">{etiqueta}</Texto>
      <TextInput
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={alCambiar}
        placeholder={ejemplo}
        placeholderTextColor={COLOR.texto3}
        keyboardType={teclado}
        autoCapitalize={mayusculas ? 'sentences' : 'none'}
        style={ui.campo}
      />
    </View>
  );
}

/** El selector de sección de arriba (Inventario · Vender · Fiado · El mes) */
export function Segmentos<T extends string>({ opciones, elegida, alElegir }: { opciones: { clave: T; texto: string; icono: NombreDeIcono }[]; elegida: T; alElegir: (c: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.segmentos} accessibilityRole="tablist">
      {opciones.map((o) => {
        const activa = o.clave === elegida;
        return (
          <Tocable
            key={o.clave}
            onPress={() => alElegir(o.clave)}
            style={[ui.segmento, activa && ui.segmentoActivo]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={o.texto}
          >
            <Icono nombre={o.icono} tamano={16} color={activa ? COLOR.lima : COLOR.bosque} />
            <Texto style={[ui.textoSegmento, activa && { color: COLOR.lima }]}>{o.texto}</Texto>
          </Tocable>
        );
      })}
    </ScrollView>
  );
}

/** Título de un bloque con su ícono girado (como las vitrinas del Inicio) */
export function CabezaDeSeccion({ icono, titulo, subtitulo, derecha }: { icono: NombreDeIcono; titulo: string; subtitulo?: string; derecha?: ReactNode }) {
  return (
    <View style={ui.cabeza}>
      <View style={ui.iconoCabeza}>
        <Icono nombre={icono} tamano={18} color={COLOR.bosque} />
      </View>
      <View style={{ flex: 1 }}>
        <Texto style={ui.tituloCabeza}>{titulo}</Texto>
        {subtitulo && <Texto v="gris">{subtitulo}</Texto>}
      </View>
      {derecha}
    </View>
  );
}

/** Una cifra grande con su nombre: «Ganaste · Bs 700,00» */
export function Cifra({ nombre, valor, tono = 'normal', estilo }: { nombre: string; valor: string; tono?: 'normal' | 'fuerte' | 'malo'; estilo?: StyleProp<ViewStyle> }) {
  return (
    <View style={[ui.cifra, tono === 'fuerte' && ui.cifraFuerte, estilo]} accessibilityLabel={`${nombre}: ${valor}`}>
      <Texto style={[ui.nombreCifra, tono === 'fuerte' && { color: COLOR.limaMedia }]}>{nombre}</Texto>
      <Texto style={[ui.valorCifra, tono === 'fuerte' && { color: COLOR.lima }, tono === 'malo' && { color: COLOR.rojoTexto }]} lineas={1} ajustar>
        {valor}
      </Texto>
    </View>
  );
}

/** Un botón grande con ícono para la acción principal de una sección («Agregar a mano», «Nueva receta») */
export function BotonDeAccion({ icono, titulo, detalle, alTocar }: { icono: NombreDeIcono; titulo: string; detalle?: string; alTocar: () => void }) {
  return (
    <Tocable onPress={alTocar} style={ui.accion} accessibilityRole="button" accessibilityLabel={titulo}>
      <View style={ui.iconoAccion}>
        <Icono nombre={icono} tamano={20} color={COLOR.lima} />
      </View>
      <View style={{ flex: 1 }}>
        <Texto v="fuerte">{titulo}</Texto>
        {detalle && <Texto v="chico">{detalle}</Texto>}
      </View>
      <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
    </Tocable>
  );
}

/** El aviso verde de «listo» dentro de una hoja */
export function Listo({ texto }: { texto: string }) {
  return (
    <View style={ui.listo} accessibilityRole="alert">
      <Icono nombre="checkmark-circle" tamano={18} color={COLOR.bosque} />
      <Texto v="fuerte" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  );
}

/** Una fila de chips para elegir uno (categoría, unidad, cliente) */
export function Opciones<T extends string>({ opciones, elegida, alElegir }: { opciones: { clave: T; texto: string }[]; elegida: T | null; alElegir: (c: T) => void }) {
  return (
    <View style={ui.opciones}>
      {opciones.map((o) => {
        const activa = o.clave === elegida;
        return (
          <Tocable key={o.clave} onPress={() => alElegir(o.clave)} style={[ui.opcion, activa && ui.opcionActiva]} accessibilityRole="radio" accessibilityState={{ selected: activa }} accessibilityLabel={o.texto}>
            <Texto style={[ui.textoOpcion, activa && { color: COLOR.lima }]}>{o.texto}</Texto>
          </Tocable>
        );
      })}
    </View>
  );
}

export const ui = StyleSheet.create({
  pieDeHoja: { gap: 8, paddingTop: 12, marginHorizontal: -20, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: COLOR.borde, backgroundColor: COLOR.superficie },
  campo: { height: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie, fontFamily: FUENTE.semi, fontSize: 16, color: COLOR.texto },
  segmentos: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  segmento: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  segmentoActivo: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  textoSegmento: { fontFamily: FUENTE.fuerte, fontSize: 13.5, color: COLOR.bosque },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconoCabeza: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-10deg' }] },
  tituloCabeza: { fontFamily: FUENTE.negra, fontSize: 19, color: COLOR.texto, letterSpacing: -0.5 },
  cifra: { flex: 1, gap: 2, padding: 14, borderRadius: 20, backgroundColor: COLOR.superficie, ...SOMBRA },
  cifraFuerte: { backgroundColor: COLOR.bosque },
  nombreCifra: { fontFamily: FUENTE.semi, fontSize: 12.5, color: COLOR.texto2 },
  valorCifra: { fontFamily: FUENTE.negra, fontSize: 20, color: COLOR.texto, letterSpacing: -0.5 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  iconoAccion: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLOR.bosque, alignItems: 'center', justifyContent: 'center' },
  listo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, backgroundColor: COLOR.limaMedia },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: { paddingHorizontal: 14, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  opcionActiva: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  textoOpcion: { fontFamily: FUENTE.fuerte, fontSize: 13, color: COLOR.bosque },
  tarjeta: { gap: 10, padding: 14, borderRadius: 22, backgroundColor: COLOR.superficie, ...SOMBRA },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, backgroundColor: COLOR.superficie, ...SOMBRA },
  foto: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: COLOR.limaSuave },
  imagenFila: { width: '84%', height: '84%' },
  pildora: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: COLOR.limaMedia },
  textoPildora: { fontFamily: FUENTE.negra, fontSize: 13, color: COLOR.bosque },
  vacio: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: COLOR.tenue, borderWidth: 1, borderColor: COLOR.borde, borderStyle: 'dashed' },
});

/**
 * El botón flotante de «Mi negocio» (02/11): reemplaza a «Agregar a mano», «Anotar a alguien», etc. Va abajo a la
 * derecha, encima de la barra, y dice qué agrega en esa sección («Insumo», «Receta», «Persona»…).
 */
export function BotonFlotante({ texto, icono = 'add', abajo, alTocar }: { texto: string; icono?: NombreDeIcono; abajo: number; alTocar: () => void }) {
  return (
    <View style={[uiExtra.flotanteLugar, { bottom: abajo }]} pointerEvents="box-none">
      <Tocable onPress={alTocar} style={uiExtra.flotante} accessibilityRole="button" accessibilityLabel={texto}>
        <Icono nombre={icono} tamano={22} color={COLOR.bosque} />
        <Texto style={uiExtra.textoFlotante}>{texto}</Texto>
      </Tocable>
    </View>
  );
}

/** Un número grande con «−» y «+» (cuántas hago, cuántas salieron). Se puede escribir también */
export function Contador({
  valor,
  alCambiar,
  paso = 1,
  minimo = 0,
  unidad,
  etiqueta,
}: {
  valor: number;
  alCambiar: (n: number) => void;
  paso?: number;
  minimo?: number;
  unidad?: string;
  etiqueta: string;
}) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  return (
    <View style={uiExtra.contador}>
      <Tocable onPress={() => alCambiar(Math.max(minimo, valor - paso))} style={uiExtra.botonContador} accessibilityRole="button" accessibilityLabel={`${paso} menos`}>
        <Icono nombre="remove" tamano={26} color={COLOR.bosque} />
      </Tocable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <TextInput
          accessibilityLabel={etiqueta}
          value={texto}
          onChangeText={(t) => {
            setTexto(t);
            const n = Number(t.replace(',', '.'));
            if (Number.isFinite(n) && n >= minimo && t.trim() !== '') alCambiar(n);
          }}
          keyboardType="decimal-pad"
          style={uiExtra.numeroContador}
        />
        {unidad && <Texto v="chico">{unidad}</Texto>}
      </View>
      <Tocable onPress={() => alCambiar(valor + paso)} style={[uiExtra.botonContador, { backgroundColor: COLOR.lima }]} accessibilityRole="button" accessibilityLabel={`${paso} más`}>
        <Icono nombre="add" tamano={26} color={COLOR.bosque} />
      </Tocable>
    </View>
  );
}

/** «1 Planifica · 2 Registra · 3 Listo»: en qué paso va */
export function Pasos({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <View style={uiExtra.pasos} accessibilityLabel={`Paso ${actual + 1} de ${pasos.length}: ${pasos[actual]}`}>
      {pasos.map((p, i) => (
        <View key={p} style={uiExtra.paso}>
          {i < pasos.length - 1 && <View style={[uiExtra.lineaPaso, i < actual && { backgroundColor: COLOR.lima }]} />}
          <View style={[uiExtra.circuloPaso, i < actual && uiExtra.pasoHecho, i === actual && uiExtra.pasoActual]}>
            {i < actual ? <Icono nombre="checkmark" tamano={14} color={COLOR.bosque} /> : <Texto style={[uiExtra.numeroPaso, i === actual && { color: COLOR.lima }]}>{i + 1}</Texto>}
          </View>
          <Texto style={[uiExtra.textoPaso, i === actual && { color: COLOR.texto }]} lineas={1}>
            {p}
          </Texto>
        </View>
      ))}
    </View>
  );
}

/** Dos opciones grandes lado a lado («Insumos | Lo que haces»), con su cantidad */
export function Alternador<T extends string>({
  opciones,
  elegida,
  alElegir,
}: {
  opciones: { clave: T; texto: string; icono: NombreDeIcono; cuantos: number }[];
  elegida: T;
  alElegir: (c: T) => void;
}) {
  return (
    <View style={uiExtra.alternador} accessibilityRole="tablist">
      {opciones.map((o) => {
        const activa = o.clave === elegida;
        return (
          <Tocable
            key={o.clave}
            onPress={() => alElegir(o.clave)}
            exterior={{ flex: 1 }}
            style={[uiExtra.opcionAlternador, activa && uiExtra.opcionAlternadorActiva]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={o.texto}
          >
            <Icono nombre={o.icono} tamano={18} color={activa ? COLOR.lima : COLOR.bosque} />
            <Texto style={[uiExtra.textoAlternador, activa && { color: '#FFFFFF' }]} lineas={1}>
              {o.texto}
            </Texto>
            <View style={[uiExtra.cuantosAlternador, activa && { backgroundColor: COLOR.lima }]}>
              <Texto style={uiExtra.textoCuantos}>{o.cuantos}</Texto>
            </View>
          </Tocable>
        );
      })}
    </View>
  );
}

export const uiExtra = StyleSheet.create({
  flotanteLugar: { position: 'absolute', right: 16 },
  flotante: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 20, height: 56, borderRadius: 28, backgroundColor: COLOR.lima, ...SOMBRA, shadowOpacity: 0.25, shadowRadius: 14, elevation: 8 },
  textoFlotante: { fontFamily: FUENTE.negra, fontSize: 15.5, color: COLOR.bosque },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 24, backgroundColor: COLOR.tenue, borderWidth: 1.5, borderColor: COLOR.borde },
  botonContador: { width: 58, height: 58, borderRadius: 20, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center' },
  numeroContador: { minWidth: 90, textAlign: 'center', fontFamily: FUENTE.negra, fontSize: 34, color: COLOR.texto, letterSpacing: -1, padding: 0 },
  pasos: { flexDirection: 'row', alignItems: 'flex-start' },
  paso: { flex: 1, alignItems: 'center', gap: 4 },
  circuloPaso: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLOR.tenue, borderWidth: 1.5, borderColor: COLOR.borde, alignItems: 'center', justifyContent: 'center' },
  pasoHecho: { backgroundColor: COLOR.lima, borderColor: COLOR.lima },
  pasoActual: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  numeroPaso: { fontFamily: FUENTE.negra, fontSize: 13, color: COLOR.texto3 },
  textoPaso: { fontFamily: FUENTE.fuerte, fontSize: 12, color: COLOR.texto3 },
  lineaPaso: { position: 'absolute', top: 13, left: '50%', right: '-50%', height: 2, backgroundColor: COLOR.borde },
  alternador: { flexDirection: 'row', gap: 6, padding: 5, borderRadius: 22, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  opcionAlternador: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 50, borderRadius: 18 },
  opcionAlternadorActiva: { backgroundColor: COLOR.bosque },
  textoAlternador: { fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.bosque },
  cuantosAlternador: { minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: COLOR.limaMedia, alignItems: 'center', justifyContent: 'center' },
  textoCuantos: { fontFamily: FUENTE.negra, fontSize: 12, color: COLOR.bosque },
});
