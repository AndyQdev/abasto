import { iniciales, tinte, escalaPorDefecto, disponible, type Mayorista, type Producto } from '@abasto/comercio';
import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { COLOR, RADIO, SOMBRA, TINTES } from './tema';

export type NombreDeIcono = ComponentProps<typeof Ionicons>['name'];

export function Icono({ nombre, tamano = 20, color = COLOR.texto }: { nombre: NombreDeIcono; tamano?: number; color?: string }) {
  return <Ionicons name={nombre} size={tamano} color={color} />;
}

type Variante = 'titulo' | 't1' | 't2' | 't3' | 'normal' | 'gris' | 'chico' | 'precio' | 'fuerte';

export function Texto({ v = 'normal', style, children, lineas }: { v?: Variante; style?: StyleProp<TextStyle>; children: ReactNode; lineas?: number }) {
  return (
    <Text numberOfLines={lineas} style={[estilos[v], style]}>
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
  tipo?: 'primario' | 'secundario' | 'chico';
  deshabilitado?: boolean;
  cargando?: boolean;
  icono?: NombreDeIcono;
}) {
  const inactivo = deshabilitado || cargando;
  const color = tipo === 'primario' ? '#fff' : COLOR.verdeTexto;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: !!inactivo }}
      disabled={inactivo}
      onPress={alTocar}
      style={({ pressed }) => [
        tipo === 'primario' ? estilos.boton : tipo === 'secundario' ? estilos.boton2 : estilos.botonChico,
        inactivo && tipo === 'primario' && { backgroundColor: '#9DB3A9' },
        pressed && { opacity: 0.85 },
      ]}
    >
      {cargando ? <ActivityIndicator color={color} /> : icono ? <Icono nombre={icono} color={color} tamano={18} /> : null}
      <Text style={[estilos.textoBoton, { color }, tipo === 'chico' && { fontSize: 13 }]}>{texto}</Text>
    </Pressable>
  );
}

export function Chip({ texto, activo, alTocar }: { texto: string; activo?: boolean; alTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo }}
      onPress={alTocar}
      style={[estilos.chip, activo && { backgroundColor: COLOR.verde, borderColor: COLOR.verde }]}
    >
      <Text style={[estilos.textoChip, activo && { color: '#fff' }]}>{texto}</Text>
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

export function Foto({ producto, alto = 76, ancho = 76, alTocar }: { producto: Pick<Producto, 'rubro' | 'nombre'>; alto?: number; ancho?: number | '100%'; alTocar?: () => void }) {
  const caja = (
    <View style={[estilos.foto, { height: alto, width: ancho, backgroundColor: TINTES[tinte(producto.rubro)] }]}>
      <Icono nombre="cube-outline" tamano={Math.min(alto / 3, 30)} color={COLOR.texto3} />
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
      <Icono nombre="add" color="#fff" tamano={22} />
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

export function Vacio({ titulo, detalle, children }: { titulo: string; detalle?: string; children?: ReactNode }) {
  return (
    <Tarjeta style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
      <Texto v="t3">{titulo}</Texto>
      {detalle && <Texto v="gris" style={{ textAlign: 'center' }}>{detalle}</Texto>}
      {children}
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
  titulo: { fontSize: 26, fontWeight: '800', color: COLOR.verde, letterSpacing: -0.5 },
  t1: { fontSize: 24, fontWeight: '800', color: COLOR.texto, letterSpacing: -0.4 },
  t2: { fontSize: 18, fontWeight: '800', color: COLOR.texto, letterSpacing: -0.3 },
  t3: { fontSize: 15, fontWeight: '700', color: COLOR.texto },
  normal: { fontSize: 14, color: COLOR.texto },
  fuerte: { fontSize: 14, fontWeight: '700', color: COLOR.texto },
  gris: { fontSize: 12.5, color: COLOR.texto3 },
  chico: { fontSize: 11, color: COLOR.texto3 },
  precio: { fontSize: 15, fontWeight: '800', color: COLOR.ambarTexto, fontVariant: ['tabular-nums'] },
  tarjeta: { backgroundColor: COLOR.superficie, borderRadius: RADIO.tarjeta, borderWidth: 1, borderColor: COLOR.borde, padding: 14, ...SOMBRA },
  boton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 15, backgroundColor: COLOR.verde },
  boton2: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 15,
    backgroundColor: COLOR.superficie,
    borderWidth: 1.5,
    borderColor: COLOR.verde,
  },
  botonChico: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 38, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLOR.verdeSuave },
  textoBoton: { fontSize: 15, fontWeight: '700' },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: COLOR.borde, backgroundColor: COLOR.superficie, justifyContent: 'center' },
  textoChip: { fontSize: 12.5, fontWeight: '600', color: COLOR.texto2 },
  insignia: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  textoInsignia: { fontSize: 11, fontWeight: '700' },
  foto: { borderRadius: RADIO.medio, alignItems: 'center', justifyContent: 'center' },
  iniciales: { backgroundColor: COLOR.verdeSuave, alignItems: 'center', justifyContent: 'center' },
  textoIniciales: { fontWeight: '800', color: COLOR.verdeTexto },
  botonMas: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLOR.verde, alignItems: 'center', justifyContent: 'center' },
  sinPrecio: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: RADIO.chico, backgroundColor: COLOR.tenue },
  textoSinPrecio: { fontSize: 12, fontWeight: '600', color: COLOR.texto2 },
  falla: { padding: 12, borderRadius: RADIO.medio, backgroundColor: COLOR.rojoSuave },
  cabezaSeccion: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  enlace: { color: COLOR.verdeTexto, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
});
