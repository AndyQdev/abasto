import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vibrar } from './animacion';
import { Icono, Texto, type NombreDeIcono } from './componentes';
import { useEstado } from './estado';
import type { Pestanas } from './navegacion';
import { CABECERA, COLOR, FUENTE, SOMBRA } from './tema';

const ICONOS: Record<keyof Pestanas, [NombreDeIcono, NombreDeIcono]> = {
  Inicio: ['home', 'home-outline'],
  Buscar: ['search', 'search-outline'],
  Carrito: ['cart', 'cart-outline'],
  Pedidos: ['receipt', 'receipt-outline'],
  Cuenta: ['person', 'person-outline'],
};

const GRIS_VERDOSO = '#7D8F86';

/**
 * La barra de abajo de ABASTO: blanca y flotante por encima del contenido, la pestaña activa en una cápsula
 * verde bosque y el carrito en una cápsula lima suave (a la misma altura, sin elevarse) con la cantidad.
 * Se esconde mientras el teclado está abierto. Las pantallas dejan abajo `useEspacioBarra()` de aire.
 */
export function BarraInferior({ state, navigation }: BottomTabBarProps) {
  const abajo = useSafeAreaInsets().bottom;
  const { carrito } = useEstado();
  const teclado = useTecladoAbierto();
  if (teclado) return null;

  return (
    <View style={[e.lugar, { paddingBottom: margenAbajo(abajo) }]}>
      <View style={e.barra}>
        {state.routes.map((ruta, i) => {
          const nombre = ruta.name as keyof Pestanas;
          const activa = state.index === i;
          const ir = () => {
            const evento = navigation.emit({ type: 'tabPress', target: ruta.key, canPreventDefault: true });
            if (!activa && !evento.defaultPrevented) {
              vibrar.toque();
              navigation.navigate(ruta.name, ruta.params);
            }
          };
          return nombre === 'Carrito' ? (
            <BotonCarrito key={ruta.key} activa={activa} cuantos={carrito.length} alTocar={ir} />
          ) : (
            <Pestana key={ruta.key} nombre={nombre} activa={activa} alTocar={ir} />
          );
        })}
      </View>
    </View>
  );
}

function Pestana({ nombre, activa, alTocar }: { nombre: keyof Pestanas; activa: boolean; alTocar: () => void }) {
  // La cápsula verde aparece con un resorte al elegir la pestaña
  const v = useRef(new Animated.Value(activa ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: activa ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 9 }).start();
  }, [activa, v]);
  const [lleno, vacio] = ICONOS[nombre];
  return (
    <Pressable onPress={alTocar} style={e.pestana} accessibilityRole="tab" accessibilityState={{ selected: activa }} accessibilityLabel={nombre}>
      <Animated.View style={[StyleSheet.absoluteFill, e.capsula, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} />
      <Icono nombre={activa ? lleno : vacio} tamano={23} color={activa ? COLOR.lima : GRIS_VERDOSO} />
      <Texto style={[e.texto, { color: activa ? '#FFFFFF' : GRIS_VERDOSO }]}>{nombre}</Texto>
    </Pressable>
  );
}

function BotonCarrito({ activa, cuantos, alTocar }: { activa: boolean; cuantos: number; alTocar: () => void }) {
  // La cápsula pasa de lima a bosque al elegirla; el número salta cuando se agrega algo
  const v = useRef(new Animated.Value(activa ? 1 : 0)).current;
  const salto = useRef(new Animated.Value(1)).current;
  const antes = useRef(cuantos);
  useEffect(() => {
    Animated.spring(v, { toValue: activa ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 9 }).start();
  }, [activa, v]);
  useEffect(() => {
    if (cuantos > antes.current) {
      Animated.sequence([
        Animated.spring(salto, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(salto, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
      ]).start();
    }
    antes.current = cuantos;
  }, [cuantos, salto]);
  return (
    <Pressable onPress={alTocar} style={e.pestana} accessibilityRole="tab" accessibilityState={{ selected: activa }} accessibilityLabel={`Carrito, ${cuantos} productos`}>
      <View style={[StyleSheet.absoluteFill, e.capsulaLima]} />
      <Animated.View style={[StyleSheet.absoluteFill, e.capsula, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} />
      <View>
        <Icono nombre="cart" tamano={23} color={activa ? COLOR.lima : CABECERA.medio} />
        {cuantos > 0 && (
          <Animated.View style={[e.cantidad, { transform: [{ scale: salto }] }]}>
            <Texto style={e.numero}>{cuantos > 99 ? '99+' : cuantos}</Texto>
          </Animated.View>
        )}
      </View>
      <Texto style={[e.texto, { color: activa ? '#FFFFFF' : CABECERA.medio, fontFamily: FUENTE.fuerte }]}>Carrito</Texto>
    </Pressable>
  );
}

/** Lo que mide la barra con su margen: las pantallas lo dejan libre abajo para que nada quede tapado. */
export function useEspacioBarra(): number {
  const abajo = useSafeAreaInsets().bottom;
  return ALTO_BARRA + margenAbajo(abajo) + 16;
}

const ALTO_BARRA = 64;
/** Pegada al borde de abajo: solo el área segura (la barra de gestos) y un respiro mínimo */
const margenAbajo = (abajo: number) => (abajo > 0 ? Math.max(abajo - 6, 6) : 8);

function useTecladoAbierto() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const a = Keyboard.addListener('keyboardDidShow', () => setAbierto(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setAbierto(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return abierto;
}

const e = StyleSheet.create({
  lugar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ALTO_BARRA,
    paddingHorizontal: 6,
    borderRadius: 28,
    backgroundColor: COLOR.superficie,
    ...SOMBRA,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  pestana: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2, marginHorizontal: 2 },
  capsula: { borderRadius: 22, backgroundColor: CABECERA.medio },
  texto: { fontFamily: FUENTE.semi, fontSize: 11.5 },
  capsulaLima: { borderRadius: 22, backgroundColor: COLOR.limaMedia },
  cantidad: {
    position: 'absolute',
    top: -7,
    right: -11,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: CABECERA.medio,
    borderWidth: 1.5,
    borderColor: COLOR.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: { fontFamily: FUENTE.negra, fontSize: 10, color: '#FFFFFF' },
});
