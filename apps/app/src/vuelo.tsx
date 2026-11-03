/**
 * «Vuela al carrito»: al agregar algo, su miniatura se eleva un poco y se desliza hasta el carrito
 * de las pestañas (o a otro destino, como el carrito de «Vender»), achicándose, con una vibración suave. Se
 * dibuja encima de toda la app.
 */
import { Image } from 'expo-image';
import { createContext, useCallback, useContext, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vibrar } from './animacion';
import type { Imagen } from './ilustraciones';

/** La vista desde donde sale (la foto del producto) */
export type Origen = RefObject<ComponentRef<typeof View> | null>;

type Volar = (origen: Origen, imagen: Imagen, destino?: Origen) => void;

const Contexto = createContext<Volar>(() => undefined);

interface Vuelo {
  id: number;
  imagen: Imagen;
  x: number;
  y: number;
  lado: number;
  avance: Animated.Value;
  /** Adónde va (el centro); null: la pestaña Carrito */
  hacia: { x: number; y: number } | null;
}

export function ProveedorDeVuelo({ children }: { children: ReactNode }) {
  const [vuelos, setVuelos] = useState<Vuelo[]>([]);
  const { width, height } = useWindowDimensions();
  const abajo = useSafeAreaInsets().bottom;
  const siguiente = useRef(0);

  const volar = useCallback<Volar>((origen, imagen, destino) => {
    vibrar.toque();
    const despegar = (hacia: Vuelo['hacia']) =>
      origen.current?.measureInWindow((x: number, y: number, ancho: number, alto: number) => {
        const lado = Math.min(ancho, alto, 120);
        const vuelo: Vuelo = { id: siguiente.current++, imagen, x: x + (ancho - lado) / 2, y: y + (alto - lado) / 2, lado, avance: new Animated.Value(0), hacia };
        setVuelos((v) => [...v, vuelo]);
        Animated.timing(vuelo.avance, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
          setVuelos((v) => v.filter((w) => w.id !== vuelo.id));
          vibrar.exito();
        });
      });
    if (!destino?.current) return despegar(null);
    destino.current.measureInWindow((x: number, y: number, ancho: number, alto: number) => despegar({ x: x + ancho / 2, y: y + alto / 2 }));
  }, []);

  // El carrito es la pestaña del medio
  const destinoX = width / 2;
  const destinoY = height - abajo - 40;

  return (
    <Contexto.Provider value={volar}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {vuelos.map((v) => {
          const dx = (v.hacia?.x ?? destinoX) - (v.x + v.lado / 2);
          const dy = (v.hacia?.y ?? destinoY) - (v.y + v.lado / 2);
          return (
            <Animated.View
              key={v.id}
              style={{
                position: 'absolute',
                left: v.x,
                top: v.y,
                width: v.lado,
                height: v.lado,
                opacity: v.avance.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateX: v.avance.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0, dx] }) },
                  // Primero se eleva y después cae hacia el carrito
                  { translateY: v.avance.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, -36, dy] }) },
                  { scale: v.avance.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 1.12, 0.22] }) },
                  { rotate: v.avance.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-14deg'] }) },
                ],
              }}
            >
              <Image source={v.imagen} style={{ width: '100%', height: '100%' }} contentFit="contain" />
            </Animated.View>
          );
        })}
      </View>
    </Contexto.Provider>
  );
}

export const useVuelo = () => useContext(Contexto);
