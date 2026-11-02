import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { COLOR } from './tema';

/**
 * El mapa de Google (Android) o de Apple (iPhone) para elegir dónde entregar, como en PedidosYa:
 * el pin queda fijo en el centro y se mueve el mapa. La clave de Android sale de `.env.local` (app.config.js).
 * La vista web usa Mapa.web.tsx.
 */
export interface Punto {
  latitud: number;
  longitud: number;
}

/** Plaza 24 de Septiembre, Santa Cruz: donde abre el mapa si no hay GPS */
export const CENTRO_SANTA_CRUZ: Punto = { latitud: -17.7833, longitud: -63.1821 };

const PROVEEDOR = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
/** Cerca, para ver la cuadra y la puerta */
const ZOOM = { latitudeDelta: 0.004, longitudeDelta: 0.004 };
const region = (p: Punto): Region => ({ latitude: p.latitud, longitude: p.longitud, ...ZOOM });

export function ElegirPunto({
  inicial,
  irA,
  alMover,
  alEmpezar,
  style,
}: {
  inicial: Punto;
  /** Cambia cuando se pide volver a «mi ubicación» */
  irA?: Punto | null;
  /** Cuando el mapa se detiene: el punto que queda bajo el pin */
  alMover: (p: Punto) => void;
  alEmpezar?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const mapa = useRef<MapView>(null);
  const [moviendo, setMoviendo] = useState(false);
  const alto = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (irA) mapa.current?.animateToRegion(region(irA), 500);
  }, [irA]);

  useEffect(() => {
    Animated.spring(alto, { toValue: moviendo ? -14 : 0, useNativeDriver: true, speed: 30, bounciness: moviendo ? 0 : 12 }).start();
  }, [moviendo, alto]);

  return (
    <View style={[{ flex: 1 }, style]}>
      <MapView
        ref={mapa}
        provider={PROVEEDOR}
        style={StyleSheet.absoluteFill}
        initialRegion={region(inicial)}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPanDrag={() => {
          if (!moviendo) {
            setMoviendo(true);
            alEmpezar?.();
          }
        }}
        onRegionChangeComplete={(r) => {
          setMoviendo(false);
          alMover({ latitud: r.latitude, longitud: r.longitude });
        }}
      />
      {/* El pin fijo: se levanta mientras se arrastra y cae al soltar */}
      <View pointerEvents="none" style={e.centro}>
        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: alto }] }}>
          <Pin />
        </Animated.View>
        <View style={[e.sombra, moviendo && { opacity: 0.25, transform: [{ scaleX: 0.7 }] }]} />
      </View>
    </View>
  );
}

/** El mapa chico, quieto, con el punto ya elegido (en la dirección y el seguimiento). */
export function MapaChico({ punto, alto = 140, style }: { punto: Punto; alto?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[e.chico, { height: alto }, style]} pointerEvents="none">
      <MapView
        provider={PROVEEDOR}
        style={StyleSheet.absoluteFill}
        region={region(punto)}
        liteMode
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
      >
        <Marker coordinate={{ latitude: punto.latitud, longitude: punto.longitud }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
          <Pin chico />
        </Marker>
      </MapView>
    </View>
  );
}

function Pin({ chico }: { chico?: boolean }) {
  const t = chico ? 0.7 : 1;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[e.cabeza, { width: 40 * t, height: 40 * t, borderRadius: 20 * t, borderWidth: 4 * t }]}>
        <View style={{ width: 12 * t, height: 12 * t, borderRadius: 6 * t, backgroundColor: COLOR.lima }} />
      </View>
      <View style={[e.palo, { height: 14 * t }]} />
    </View>
  );
}

const e = StyleSheet.create({
  // El pie del pin (no la cabeza) cae justo en el centro del mapa
  centro: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 48 },
  // (pin 54 + sombra 6 = 60 de alto: con 48 abajo, el pie del palo queda en el centro exacto)
  cabeza: { backgroundColor: COLOR.bosque, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  palo: { width: 3, borderRadius: 2, backgroundColor: COLOR.bosque },
  sombra: { width: 14, height: 5, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.35)', marginTop: 1 },
  chico: { borderRadius: 18, overflow: 'hidden', backgroundColor: COLOR.tenue },
});
