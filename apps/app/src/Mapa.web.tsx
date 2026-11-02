import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icono, Texto } from './componentes';
import { COLOR } from './tema';

/** La vista web de desarrollo no tiene mapa nativo: se muestra un recuadro y se sigue con el punto inicial. */
export interface Punto {
  latitud: number;
  longitud: number;
}

export const CENTRO_SANTA_CRUZ: Punto = { latitud: -17.7833, longitud: -63.1821 };

export function ElegirPunto({ style }: { inicial: Punto; irA?: Punto | null; alMover: (p: Punto) => void; alEmpezar?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[e.caja, { flex: 1 }, style]}>
      <Icono nombre="map-outline" tamano={40} color={COLOR.texto3} />
      <Texto v="gris">El mapa se ve en el teléfono</Texto>
    </View>
  );
}

export function MapaChico({ alto = 140, style }: { punto: Punto; alto?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[e.caja, { height: alto, borderRadius: 18 }, style]}>
      <Icono nombre="location" tamano={28} color={COLOR.bosque} />
    </View>
  );
}

const e = StyleSheet.create({ caja: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLOR.tenue } });
