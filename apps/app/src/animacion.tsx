/**
 * Los efectos de la app, con el Animated de React Native (sin librerías nativas extra):
 * se hunde al tocar, entra deslizándose, brillo mientras carga, hoja que sube desde abajo y sacudida.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOR } from './tema';

/** Vibración corta al tocar algo importante. En la vista web no hace nada. */
export const vibrar = {
  toque: () => Platform.OS !== 'web' && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  exito: () => Platform.OS !== 'web' && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  error: () => Platform.OS !== 'web' && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined),
};

/** Un botón o una tarjeta que se hunde un poco al tocarlo y vuelve con un resorte. */
export function Tocable({
  children,
  style,
  exterior,
  hundir = 0.96,
  conVibracion = true,
  onPress,
  ...resto
}: Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** El lugar que ocupa en su fila (flex: 1, alignSelf…): va en la caja de afuera, la que no se hunde */
  exterior?: StyleProp<ViewStyle>;
  hundir?: number;
  conVibracion?: boolean;
  children: ReactNode;
}) {
  const escala = useRef(new Animated.Value(1)).current;
  const a = (valor: number) => Animated.spring(escala, { toValue: valor, useNativeDriver: true, speed: 40, bounciness: valor === 1 ? 10 : 0 }).start();
  return (
    <Pressable
      {...resto}
      style={exterior}
      onPressIn={() => a(hundir)}
      onPressOut={() => a(1)}
      onPress={(e) => {
        if (conVibracion) vibrar.toque();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: escala }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Entra deslizándose desde abajo; `orden` lo retrasa para que las cosas aparezcan una detrás de otra. */
export function Aparecer({ children, orden = 0, desde = 18, style }: { children: ReactNode; orden?: number; desde?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay: orden * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, orden]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [desde, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Rectángulo que brilla suave mientras llegan los datos. */
export function Esqueleto({ alto, ancho = '100%', radio = 14, style }: { alto: number; ancho?: number | `${number}%`; radio?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [v]);
  return <Animated.View style={[{ height: alto, width: ancho, borderRadius: radio, backgroundColor: COLOR.borde, opacity: v }, style]} />;
}

/** Devuelve una sacudida horizontal (para un código incorrecto) y la función que la dispara. */
export function useSacudida(): [Animated.Value, () => void] {
  const x = useRef(new Animated.Value(0)).current;
  const sacudir = () =>
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((toValue) => Animated.timing(x, { toValue, duration: 45, useNativeDriver: true })),
    ).start();
  return [x, sacudir];
}

/** Hoja que sube desde abajo sobre un fondo oscuro, como «Confirma tu dirección» de PedidosYa. */
export function HojaInferior({ visible, alCerrar, children }: { visible: boolean; alCerrar?: () => void; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  const abajo = useSafeAreaInsets().bottom;
  useEffect(() => {
    Animated.spring(v, { toValue: visible ? 1 : 0, useNativeDriver: true, speed: 14, bounciness: 4 }).start();
  }, [visible, v]);
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={alCerrar}>
      <Animated.View style={[StyleSheet.absoluteFill, e.fondo, { opacity: v }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={alCerrar} accessibilityLabel="Cerrar" disabled={!alCerrar} />
      </Animated.View>
      <Animated.View
        style={[e.hoja, { paddingBottom: 20 + abajo, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }] }]}
      >
        <View style={e.asa} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const e = StyleSheet.create({
  fondo: { backgroundColor: 'rgba(10, 28, 22, 0.55)' },
  hoja: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLOR.superficie,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '86%',
  },
  asa: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: COLOR.borde, marginBottom: 12 },
});
