import { Image } from 'expo-image';
import { iniciales, tinte, escalaPorDefecto, disponible, type Mayorista, type Producto } from '@abasto/comercio';
import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { fotoDe } from './ilustraciones';
import { COLOR, fuenteDe, FUENTE, RADIO, SOMBRA, TINTES } from './tema';

export type NombreDeIcono = ComponentProps<typeof Ionicons>['name'];

export function Icono({ nombre, tamano = 20, color = COLOR.texto }: { nombre: NombreDeIcono; tamano?: number; color?: string }) {
  return <Ionicons name={nombre} size={tamano} color={color} />;
}

type Variante = 'titulo' | 't1' | 't2' | 't3' | 'normal' | 'gris' | 'chico' | 'precio' | 'fuerte';

export function Texto({
  v = 'normal',
  style,
  children,
  lineas,
  ajustar,
}: {
  v?: Variante;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  lineas?: number;
  /** Achica la letra (hasta 80 %) para que entre en sus líneas en vez de cortarse */
  ajustar?: boolean;
}) {
  // Plus Jakarta Sans: el grosor se elige por archivo; fontWeight se quita para que Android no lo engrose de nuevo
  const plano: TextStyle = StyleSheet.flatten([estilos[v], style]) ?? {};
  const { fontWeight, ...resto } = plano;
  return (
    <Text numberOfLines={lineas} adjustsFontSizeToFit={ajustar} minimumFontScale={ajustar ? 0.8 : undefined} style={[resto, { fontFamily: resto.fontFamily ?? fuenteDe(fontWeight) }]}>
      {children}
    </Text>
  );
}

export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.tarjeta, style]}>{children}</View>;
}

export function Boton({
  texto,
  alTocar,
  tipo = 'primario',
  deshabilitado,
  cargando,
  icono,
}: {
  texto: string;
  alTocar: () => void;
  /** primario: lima (enviar, agregar) · oscuro: bosque (continuar, cerrar la compra) */
  tipo?: 'primario' | 'oscuro' | 'secundario' | 'chico';
  deshabilitado?: boolean;
  cargando?: boolean;
  icono?: NombreDeIcono;
}) {
  const inactivo = deshabilitado || cargando;
  const color = inactivoColor(tipo, deshabilitado || cargando);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: !!inactivo }}
      disabled={inactivo}
      onPress={alTocar}
      style={({ pressed }) => [
        tipo === 'primario' ? estilos.boton : tipo === 'oscuro' ? estilos.botonOscuro : tipo === 'secundario' ? estilos.boton2 : estilos.botonChico,
        inactivo && (tipo === 'primario' || tipo === 'oscuro') && { backgroundColor: '#DDE5D2' },
        pressed && tipo === 'oscuro' && { backgroundColor: COLOR.bosqueMedio },
        pressed && tipo === 'primario' && { backgroundColor: COLOR.limaFuerte },
        pressed && tipo !== 'primario' && tipo !== 'oscuro' && { opacity: 0.85 },
      ]}
    >
      {cargando ? <ActivityIndicator color={color} /> : icono ? <Icono nombre={icono} color={color} tamano={18} /> : null}
      <Text style={[estilos.textoBoton, { color }, tipo === 'chico' && { fontSize: 13 }]}>{texto}</Text>
    </Pressable>
  );
}

/** Texto del botón: verde oscuro sobre el lima; apagado si está inactivo. */
function inactivoColor(tipo: 'primario' | 'oscuro' | 'secundario' | 'chico', inactivo?: boolean) {
  if (inactivo && (tipo === 'primario' || tipo === 'oscuro')) return '#93A188';
  return tipo === 'oscuro' ? '#fff' : COLOR.bosque;
}

export function Chip({ texto, activo, alTocar }: { texto: string; activo?: boolean; alTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo }}
      onPress={alTocar}
      style={[estilos.chip, activo && { backgroundColor: COLOR.lima, borderColor: COLOR.verde }]}
    >
      <Text style={[estilos.textoChip, activo && { color: COLOR.verde }]}>{texto}</Text>
    </Pressable>
  );
}

const INSIGNIAS = {
  verde: [COLOR.verdeSuave, COLOR.verdeTexto],
  ambar: [COLOR.ambarSuave, COLOR.ambarTexto],
  rojo: [COLOR.rojoSuave, COLOR.rojoTexto],
  gris: [COLOR.tenue, COLOR.texto2],
} as const;

export type ColorDeInsignia = keyof typeof INSIGNIAS;

/** Estado siempre con su palabra adentro, nunca solo color */
export function Insignia({ texto, color = 'verde' }: { texto: string; color?: ColorDeInsignia }) {
  const [fondo, letra] = INSIGNIAS[color];
  return (
    <View style={[estilos.insignia, { backgroundColor: fondo }]}>
      <Text style={[estilos.textoInsignia, { color: letra }]}>{texto}</Text>
    </View>
  );
}

/** Clases de ins-* de @abasto/comercio a los colores de la app */
export const colorDeClase = (clase: string): ColorDeInsignia =>
  clase.includes('verde') ? 'verde' : clase.includes('ambar') ? 'ambar' : clase.includes('rojo') ? 'rojo' : 'gris';

export function Foto({ producto, alto = 76, ancho = 76, alTocar }: { producto: Pick<Producto, 'rubro' | 'nombre' | 'foto'>; alto?: number; ancho?: number | '100%'; alTocar?: () => void }) {
  // La foto real va sobre blanco, como en cualquier tienda; la ilustración del rubro, sobre su tinte
  const caja = (
    <View style={[estilos.foto, { height: alto, width: ancho, backgroundColor: producto.foto ? COLOR.superficie : TINTES[tinte(producto.rubro)] }]}>
      <Image source={fotoDe(producto)} style={{ width: '86%', height: '86%' }} contentFit="contain" transition={200} accessibilityIgnoresInvertColors />
    </View>
  );
  return alTocar ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${producto.nombre}`} onPress={alTocar}>
      {caja}
    </Pressable>
  ) : (
    caja
  );
}

export function Iniciales({ nombre, tamano = 38, oscuro }: { nombre: string; tamano?: number; oscuro?: boolean }) {
  return (
    <View style={[estilos.iniciales, { width: tamano, height: tamano, borderRadius: tamano * 0.32 }, oscuro && { backgroundColor: COLOR.tinta }]}>
      <Text style={[estilos.textoIniciales, { fontSize: tamano * 0.34 }, oscuro && { color: '#fff' }]}>{iniciales(nombre)}</Text>
    </View>
  );
}

/** Botón verde «+»: agrega la escala por defecto (una docena) */
export function BotonMas({ producto, alAgregar }: { producto: Producto; alAgregar: (p: Producto) => void }) {
  const escala = escalaPorDefecto(producto);
  if (!escala || !disponible(producto)) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Agregar una ${escala.presentacion.toLowerCase()} de ${producto.nombre}`}
      onPress={() => alAgregar(producto)}
      style={({ pressed }) => [estilos.botonMas, pressed && { opacity: 0.8 }]}
    >
      <Icono nombre="add" color={COLOR.verde} tamano={22} />
    </Pressable>
  );
}

export function SinPrecio({ texto = 'Pide ser cliente para ver precios' }: { texto?: string }) {
  return (
    <View style={estilos.sinPrecio}>
      <Icono nombre="lock-closed-outline" tamano={14} color={COLOR.texto2} />
      <Text style={estilos.textoSinPrecio}>{texto}</Text>
    </View>
  );
}

/** Lo que ve una tienda cuando un mayorista afiliado todavía no la aprobó (Abasto le vende a todas). */
export function PedirSerCliente({
  mayorista,
  enLinea,
  alPedir,
  titulo,
  detalle,
}: {
  mayorista: Mayorista;
  enLinea: boolean;
  alPedir: (id: string) => Promise<string | null>;
  titulo: string;
  detalle: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const puedePedir = mayorista.relacion === 'NINGUNA' || mayorista.relacion === 'RECHAZADA';
  return (
    <Tarjeta style={{ gap: 10 }}>
      <Texto v="t3">{titulo}</Texto>
      <Texto v="gris">{detalle}</Texto>
      {mayorista.relacion === 'RECHAZADA' && <Insignia texto="El mayorista no aprobó tu solicitud anterior" color="gris" />}
      {puedePedir && (
        <Boton
          texto={mayorista.relacion === 'RECHAZADA' ? 'Volver a pedir' : 'Pedir ser cliente'}
          deshabilitado={!enLinea}
          cargando={enviando}
          alTocar={async () => {
            setEnviando(true);
            setError(null);
            setError(await alPedir(mayorista.id));
            setEnviando(false);
          }}
        />
      )}
      {mayorista.relacion === 'SOLICITADA' && <Insignia texto="Solicitud enviada · por confirmar" color="ambar" />}
      {error && <Falla texto={error} />}
    </Tarjeta>
  );
}

export function Falla({ texto }: { texto: string }) {
  return (
    <View style={estilos.falla}>
      <Text style={{ color: COLOR.rojoTexto }}>{texto}</Text>
    </View>
  );
}

export function Vacio({ titulo, detalle, imagen, children }: { titulo: string; detalle?: string; imagen?: number; children?: ReactNode }) {
  return (
    <Tarjeta style={{ alignItems: 'center', gap: 8, paddingVertical: imagen ? 18 : 28 }}>
      {/* contain: la ilustración 3D entera, sin cortes; chica, para que no ocupe media pantalla sin hacer nada (02/11) */}
      {imagen !== undefined && <Image source={imagen} style={{ width: 130, height: 130 }} contentFit="contain" transition={250} />}
      <Texto v="t3">{titulo}</Texto>
      {detalle && <Texto v="gris" style={{ textAlign: 'center' }}>{detalle}</Texto>}
      {/* Los botones de abajo, de lado a lado: así nunca se cortan */}
      {children && <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>{children}</View>}
    </Tarjeta>
  );
}

/** Fila con título a la izquierda y un enlace «Ver todos» a la derecha */
export function Seccion({ titulo, enlace, alTocarEnlace, children }: { titulo: string; enlace?: string; alTocarEnlace?: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={estilos.cabezaSeccion}>
        <Texto v="t2">{titulo}</Texto>
        {enlace && (
          <Pressable accessibilityRole="link" onPress={alTocarEnlace}>
            <Text style={estilos.enlace}>{enlace}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

export const estilos = StyleSheet.create({
  titulo: { fontSize: 28, fontWeight: '800', color: COLOR.texto, letterSpacing: -0.6 },
  t1: { fontSize: 24, fontWeight: '800', color: COLOR.texto, letterSpacing: -0.5 },
  t2: { fontSize: 19, fontWeight: '800', color: COLOR.texto, letterSpacing: -0.3 },
  t3: { fontSize: 16, fontWeight: '700', color: COLOR.texto },
  normal: { fontSize: 14, color: COLOR.texto },
  fuerte: { fontSize: 14, fontWeight: '700', color: COLOR.texto },
  gris: { fontSize: 13, color: COLOR.texto3 },
  chico: { fontSize: 11.5, color: COLOR.texto3 },
  precio: { fontSize: 17, fontWeight: '800', color: COLOR.texto, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  tarjeta: { backgroundColor: COLOR.superficie, borderRadius: RADIO.tarjeta, padding: 14, ...SOMBRA },
  boton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 18, backgroundColor: COLOR.lima, ...SOMBRA, shadowColor: '#6E9400', shadowOpacity: 0.22 },
  botonOscuro: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 18, backgroundColor: COLOR.bosque, ...SOMBRA },
  boton2: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 18,
    backgroundColor: COLOR.mentaClara,
  },
  botonChico: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 40, paddingHorizontal: 16, borderRadius: 14, backgroundColor: COLOR.mentaClara },
  textoBoton: { fontSize: 15.5, fontFamily: FUENTE.fuerte },
  chip: { height: 38, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie, justifyContent: 'center' },
  textoChip: { fontSize: 13, fontFamily: FUENTE.semi, color: COLOR.texto2 },
  insignia: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  textoInsignia: { fontSize: 11, fontFamily: FUENTE.fuerte },
  foto: { borderRadius: RADIO.medio, alignItems: 'center', justifyContent: 'center' },
  iniciales: { backgroundColor: COLOR.mentaClara, alignItems: 'center', justifyContent: 'center' },
  textoIniciales: { fontFamily: FUENTE.negra, color: COLOR.verde },
  botonMas: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  sinPrecio: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: RADIO.chico, backgroundColor: COLOR.tenue },
  textoSinPrecio: { fontSize: 12, fontFamily: FUENTE.semi, color: COLOR.texto2 },
  falla: { padding: 12, borderRadius: RADIO.medio, backgroundColor: COLOR.rojoSuave },
  cabezaSeccion: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  enlace: { color: COLOR.verde, fontFamily: FUENTE.fuerte, fontSize: 13.5 },
});

/** El logo de ABASTO: el carrito en un cuadrado menta y la palabra en negrita. `claro` para fondos oscuros. */
export function Logo({ tamano = 30, claro }: { tamano?: number; claro?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tamano * 0.28 }}>
      <View style={{ width: tamano, height: tamano, borderRadius: tamano * 0.3, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cart" size={tamano * 0.6} color={COLOR.verde} />
      </View>
      <Text style={{ fontFamily: FUENTE.negra, fontSize: tamano * 0.72, letterSpacing: -0.5, color: claro ? '#fff' : COLOR.verde }}>ABASTO</Text>
    </View>
  );
}
