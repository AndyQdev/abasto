import { escalaPorDefecto, disponible, type Producto } from '@abasto/comercio';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { vibrar } from './animacion';
import { Icono, Texto } from './componentes';
import { useEstado } from './estado';
import { COLOR, FUENTE, SOMBRA } from './tema';

/**
 * El «+» de las tarjetas (02/11, pedido del usuario: que se note que se agregó). Al tocarlo salta, se vuelve un check
 * lima por un momento y después muestra cuántos llevas de ese producto. Tocarlo otra vez suma uno más.
 */
export function BotonAgregar({
  producto,
  alAgregar,
  oscuro = true,
  estilo,
}: {
  producto: Producto;
  alAgregar: (p: Producto) => void;
  /** Bosque con el «+» lima (sobre fotos) o lima con el «+» bosque (sobre fondo claro) */
  oscuro?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const { carrito } = useEstado();
  const escala = escalaPorDefecto(producto);
  const llevas = carrito.filter((i) => i.productoId === producto.id).reduce((s, i) => s + i.cantidad, 0);
  const salto = useRef(new Animated.Value(1)).current;
  const [listo, setListo] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reloj.current), []);
  if (!escala || !disponible(producto)) return null;

  const tocar = () => {
    vibrar.toque();
    alAgregar(producto);
    setListo(true);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setListo(false), 900);
    salto.setValue(0.7);
    Animated.spring(salto, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 18 }).start();
  };

  const lleno = listo || llevas > 0;
  return (
    <Pressable
      onPress={tocar}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={llevas ? `Agregar otra ${escala.presentacion.toLowerCase()} de ${producto.nombre}; llevas ${llevas}` : `Agregar una ${escala.presentacion.toLowerCase()} de ${producto.nombre}`}
      style={estilo}
    >
      <Animated.View style={[e.boton, oscuro ? e.oscuro : e.claro, lleno && e.lleno, { transform: [{ scale: salto }] }]}>
        {listo ? (
          <Icono nombre="checkmark" tamano={20} color={COLOR.bosque} />
        ) : llevas > 0 ? (
          <Texto style={e.cuantos}>{llevas > 99 ? '99+' : llevas}</Texto>
        ) : (
          <Icono nombre="add" tamano={20} color={oscuro ? COLOR.lima : COLOR.bosque} />
        )}
      </Animated.View>
      {llevas > 0 && !listo && (
        <View style={e.mas} pointerEvents="none">
          <Icono nombre="add" tamano={11} color={COLOR.lima} />
        </View>
      )}
    </Pressable>
  );
}

const e = StyleSheet.create({
  boton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', ...SOMBRA, shadowOpacity: 0.2 },
  oscuro: { backgroundColor: COLOR.bosque },
  claro: { backgroundColor: COLOR.lima },
  lleno: { backgroundColor: COLOR.lima, borderWidth: 2, borderColor: COLOR.bosque },
  cuantos: { fontFamily: FUENTE.negra, fontSize: 14, color: COLOR.bosque },
  mas: { position: 'absolute', right: -3, top: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: COLOR.bosque, alignItems: 'center', justifyContent: 'center' },
});
