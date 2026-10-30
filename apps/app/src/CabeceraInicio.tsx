import { filtrarPedidos, MIS_COMPRAS, type Pedido } from '@abasto/comercio';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Aparecer, Tocable } from './animacion';
import { graphql } from './api';
import { Icono, Texto } from './componentes';
import { resumen, type Direccion } from './direcciones';
import { CABECERA, COLOR, FUENTE, SOMBRA } from './tema';

/** Cuánto baja el bosque por debajo de la línea del buscador (la curva de la derecha) */
const COLA = 34;

/**
 * Encabezado del Inicio, compacto para que los productos se vean apenas se abre la app (31/10, referencia
 * `pedidosYa/image7.png`): el logo, la dirección en una cápsula y la campana en una sola fila, y el buscador
 * blanco montado sobre el borde, que baja en curva por la derecha.
 */
export function CabeceraInicio({
  direccion,
  alCambiarDireccion,
  alBuscar,
  alBuscarConFoto,
  alVerPedidos,
}: {
  direccion: Direccion | null;
  alCambiarDireccion: () => void;
  alBuscar: () => void;
  alBuscarConFoto: () => void;
  alVerPedidos: () => void;
}) {
  const { width: W } = useWindowDimensions();
  const arriba = useSafeAreaInsets().top;
  const pendientes = usePedidosEnCurso();
  // H: la línea donde se apoya el buscador (lo cruza por la mitad)
  const H = arriba + 100;

  return (
    <View style={{ height: H + COLA }}>
      <Svg width={W} height={H + COLA} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bosque" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={CABECERA.oscuro} />
            <Stop offset="0.55" stopColor={CABECERA.medio} />
            <Stop offset="1" stopColor={CABECERA.claro} />
          </LinearGradient>
        </Defs>
        <Path d={silueta(W, H)} fill="url(#bosque)" />
        {/* Calles muy tenues, como un mapa de Santa Cruz visto desde arriba */}
        <Path d={calles(W, H)} stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={10} fill="none" strokeLinecap="round" />
        <Path d={calles(W, H)} stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={2} fill="none" strokeDasharray="6 10" />
      </Svg>

      <View style={[e.fila, { paddingTop: arriba + 8 }]}>
        <Texto style={e.logo}>
          ABAST<Texto style={[e.logo, { color: COLOR.lima }]}>O</Texto>
        </Texto>
        <Aparecer desde={-8} style={{ flex: 1 }}>
          <Tocable onPress={alCambiarDireccion} style={e.direccion} accessibilityRole="button" accessibilityLabel={`Entregar en ${resumen(direccion)}. Cambiar dirección`}>
            <View style={e.pin}>
              <Icono nombre="location" tamano={19} color={CABECERA.medio} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Texto style={e.etiqueta}>Entregar en{direccion ? ` · ${direccion.etiqueta}` : ''}</Texto>
              <View style={e.filaChica}>
                <Texto lineas={1} style={e.calle}>
                  {resumen(direccion)}
                </Texto>
                <Icono nombre="chevron-down" tamano={15} color="#FFFFFF" />
              </View>
            </View>
          </Tocable>
        </Aparecer>
        <Tocable onPress={alVerPedidos} style={e.campana} accessibilityRole="button" accessibilityLabel={pendientes ? `${pendientes} pedidos en curso` : 'Mis pedidos'}>
          <Icono nombre="notifications" tamano={20} color="#FFFFFF" />
          {pendientes > 0 && (
            <View style={e.puntoRojo}>
              <Texto style={e.numero}>{pendientes > 9 ? '9+' : pendientes}</Texto>
            </View>
          )}
        </Tocable>
      </View>

      <Aparecer orden={1} desde={14} style={[e.lugarBuscador, { top: H - 27 }]}>
        <View style={e.buscador}>
          <Tocable hundir={0.98} conVibracion={false} accessibilityRole="search" exterior={{ flex: 1 }} style={e.buscadorTexto} onPress={alBuscar}>
            <Icono nombre="search" tamano={22} color={COLOR.texto} />
            <Texto lineas={1} style={e.placeholder}>
              Busca productos al por mayor…
            </Texto>
          </Tocable>
          <Tocable accessibilityRole="button" accessibilityLabel="Buscar con una foto" onPress={alBuscarConFoto} style={e.camara}>
            <Icono nombre="camera" color={CABECERA.medio} tamano={22} />
          </Tocable>
        </View>
      </Aparecer>
    </View>
  );
}

/** Borde de abajo: casi recto a la izquierda (el buscador asoma sobre el fondo claro) y una curva que baja a la derecha. */
function silueta(W: number, H: number) {
  return [
    `M0 0 H${W} V${H + 14}`,
    `C${W} ${H + 30} ${W - 24} ${H + COLA} ${W - 56} ${H + 26}`,
    `C${W - 120} ${H + 12} ${W * 0.6} ${H - 6} ${W * 0.42} ${H - 10}`,
    `C${W * 0.25} ${H - 14} ${W * 0.1} ${H - 30} 0 ${H - 22} Z`,
  ].join(' ');
}

/** Tres calles curvas que cruzan el bosque */
function calles(W: number, H: number) {
  return [
    `M${W * 0.18} -10 C${W * 0.3} ${H * 0.35} ${W * 0.2} ${H * 0.6} ${W * 0.42} ${H + 10}`,
    `M${W * 0.55} -10 C${W * 0.62} ${H * 0.3} ${W * 0.9} ${H * 0.4} ${W + 10} ${H * 0.75}`,
    `M-10 ${H * 0.42} C${W * 0.25} ${H * 0.5} ${W * 0.5} ${H * 0.2} ${W * 0.8} ${H * 0.28}`,
  ].join(' ');
}

/** Cuántos pedidos tiene en curso (para el número de la campana). Se actualiza cada vez que se vuelve al Inicio. */
function usePedidosEnCurso(): number {
  const [cuantos, setCuantos] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      graphql<{ misCompras: Pedido[] }>(MIS_COMPRAS)
        .then((d) => vivo && setCuantos(filtrarPedidos(d.misCompras, 'en_curso').length))
        .catch(() => undefined);
      return () => {
        vivo = false;
      };
    }, []),
  );
  return cuantos;
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  logo: { fontFamily: FUENTE.negra, fontSize: 25, color: '#FFFFFF', letterSpacing: -0.8 },
  direccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  pin: { width: 36, height: 36, borderRadius: 13, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  etiqueta: { fontFamily: FUENTE.semi, fontSize: 11.5, color: COLOR.lima },
  filaChica: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  calle: { fontFamily: FUENTE.negra, fontSize: 15, color: '#FFFFFF', flexShrink: 1, letterSpacing: -0.3 },
  campana: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntoRojo: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    backgroundColor: COLOR.rojo,
    borderWidth: 2,
    borderColor: CABECERA.medio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: { fontFamily: FUENTE.negra, fontSize: 11, color: '#FFFFFF' },
  lugarBuscador: { position: 'absolute', left: 16, right: 16 },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 27,
    backgroundColor: COLOR.superficie,
    paddingLeft: 20,
    paddingRight: 6,
    ...SOMBRA,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  buscadorTexto: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 50 },
  placeholder: { fontFamily: FUENTE.normal, fontSize: 15, color: COLOR.texto3, flexShrink: 1 },
  camara: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
});
