import {
  compensaciones,
  fechaHora,
  nombreDe,
  PAGAR_QR_DE_PRUEBA,
  productos as cuantos,
  titularDelPedido,
  UN_PEDIDO,
  type Pedido,
  type Presentacion,
} from '@abasto/comercio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Tocable } from '../animacion';
import { graphql } from '../api';
import { Falla, Foto, Icono, Iniciales, Insignia, Tarjeta, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import { ILUSTRACION } from '../ilustraciones';
import { LineaDeTiempo, PagoExitoso } from '../linea-de-tiempo';
import { MapaChico } from '../Mapa';
import type { PantallaDePila } from '../navegacion';
import { COLOR, FUENTE } from '../tema';
import { unaALaVez, useAvisosDePedidos } from '../tiempo-real';

const PAGO = { QR: 'Pago por QR', CREDITO: 'Crédito', CONTRA_ENTREGA: 'Contra entrega' } as const;

/**
 * El seguimiento de una compra (rediseño 02/11, pedido de Andrés): arriba, en grande, qué pasa ahora; justo debajo la
 * línea de tiempo con el paso actual latiendo y, si falta pagar con QR, el QR ahí mismo. Al pagar, el festejo a
 * pantalla completa. Abajo los detalles: vendedor, dirección y productos. Se actualiza en tiempo real (Conecta).
 */
export function Seguimiento({ route, navigation }: PantallaDePila<'Seguimiento'>) {
  const { enLinea } = useEstado();
  const arriba = useSafeAreaInsets().top;
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [festejo, setFestejo] = useState(false);
  const cobroAntes = useRef<string | null>(null);
  const id = route.params.id;

  const traer = useMemo(
    () =>
      unaALaVez(async () => {
        if (!enLinea) return;
        try {
          const d = await graphql<{ pedido: Pedido | null }>(UN_PEDIDO, { id });
          setPedido(d.pedido);
          setError(null);
        } catch (e) {
          setError((e as Error).message);
        }
      }),
    [id, enLinea],
  );
  useEffect(() => {
    void traer();
  }, [traer]);
  // Solo los avisos de este pedido; al volver la conexión, se pide una vez por si se perdió algo
  useAvisosDePedidos(
    (a) => a.pedidoId === id && void traer(),
    () => void traer(),
  );

  // El festejo sale cuando el QR pasa de «por pagar» a «pagado» con la pantalla abierta (pague aquí o en el banco)
  useEffect(() => {
    const ahora = pedido?.cobro?.estado ?? null;
    if (cobroAntes.current === 'PENDIENTE' && ahora === 'PAGADO') setFestejo(true);
    cobroAntes.current = ahora;
  }, [pedido?.cobro?.estado]);

  const pagar = async () => {
    setPagando(true);
    try {
      await graphql(PAGAR_QR_DE_PRUEBA, { id });
      await traer();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPagando(false);
    }
  };

  const volver = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Pestanas', { screen: 'Pedidos' }));

  if (!pedido) {
    return (
      <View style={[e.pantalla, { paddingTop: arriba + 12, padding: 16, gap: 12 }]}>
        <Tocable onPress={volver} style={e.atrasClaro} accessibilityRole="button" accessibilityLabel="Volver">
          <Icono nombre="arrow-back" tamano={22} color={COLOR.bosque} />
        </Tocable>
        {error ? <Falla texto={error} /> : <Vacio titulo={enLinea ? 'Cargando tu compra…' : 'Necesitas conexión para ver el seguimiento'} />}
      </View>
    );
  }

  const titular = titularDelPedido(pedido);
  const deshecho = compensaciones(pedido);
  const vendedor = pedido.mayorista.nombre ?? pedido.mayorista.id;

  return (
    <View style={e.pantalla}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Arriba: qué pasa ahora, en grande */}
        <LinearGradient colors={[COLOR.bosque, '#21402F']} style={[e.cabecera, { paddingTop: arriba + 8 }]}>
          <View style={e.filaCabecera}>
            <Tocable onPress={volver} style={e.atras} accessibilityRole="button" accessibilityLabel="Volver">
              <Icono nombre="arrow-back" tamano={22} color={COLOR.lima} />
            </Tocable>
            <Texto style={e.codigo}>
              Compra #{pedido.codigo} · {vendedor}
            </Texto>
          </View>
          <Aparecer key={titular.titulo} style={e.filaTitular}>
            <View style={{ flex: 1 }}>
              <Texto style={e.titular}>{titular.titulo}</Texto>
              <Texto style={e.detalleTitular}>{titular.detalle}</Texto>
            </View>
            {/* Al final, la ilustración festeja la entrega: chica, al costado del titular */}
            {pedido.estado === 'ENTREGADO' && <Image source={ILUSTRACION.pedidoEntregado} style={e.entregado} contentFit="contain" accessibilityIgnoresInvertColors />}
          </Aparecer>
        </LinearGradient>

        <View style={e.cuerpo}>
          {/* La línea de tiempo, con el paso actual latiendo y el QR si falta pagar */}
          <View style={e.tarjetaLinea}>
            <LineaDeTiempo pedido={pedido} pagando={pagando} alPagar={() => void pagar()} />
          </View>
          {error && <Falla texto={error} />}

          {deshecho.length > 0 && (
            <View style={e.deshecho}>
              <Texto v="t3">Lo deshicimos por ti</Texto>
              {deshecho.map((d) => (
                <View key={d} style={e.fila}>
                  <Icono nombre="checkmark-circle" tamano={18} color={COLOR.bosque} />
                  <Texto style={{ flex: 1 }}>{d}</Texto>
                </View>
              ))}
            </View>
          )}

          {/* Los detalles van abajo */}
          <Tarjeta style={e.fila}>
            <Iniciales nombre={vendedor} />
            <View style={{ flex: 1 }}>
              <Texto v="fuerte">{vendedor}</Texto>
              <Texto v="gris">
                {PAGO[pedido.metodoPago]} · {fechaHora(pedido.creadoEn)}
              </Texto>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Texto v="fuerte">{pedido.total.centavos ? pedido.total.texto : '—'}</Texto>
              <Texto v="gris">{cuantos(pedido.lineas.length)}</Texto>
            </View>
          </Tarjeta>

          {pedido.entrega && (
            <Tarjeta style={{ gap: 10 }}>
              {pedido.entrega.latitud !== null && pedido.entrega.longitud !== null && (
                <MapaChico punto={{ latitud: pedido.entrega.latitud, longitud: pedido.entrega.longitud }} alto={110} />
              )}
              <View style={e.fila}>
                <Icono nombre="location" color={COLOR.bosque} />
                <View style={{ flex: 1 }}>
                  <Texto v="chico">Entregar en</Texto>
                  <Texto v="fuerte">{pedido.entrega.texto}</Texto>
                  {!!pedido.entrega.referencia && <Texto v="gris">{pedido.entrega.referencia}</Texto>}
                </View>
              </View>
            </Tarjeta>
          )}

          <Tarjeta style={{ gap: 10 }}>
            <View style={e.entre}>
              <Texto v="t3">Lo que pediste</Texto>
              <Insignia texto={cuantos(pedido.lineas.length)} color="gris" />
            </View>
            {pedido.lineas.map((l, i) => (
              <View key={`${l.producto.id}-${i}`} style={e.fila}>
                <Foto producto={{ nombre: l.producto.nombre ?? l.producto.id, rubro: l.producto.rubro ?? '' }} alto={42} ancho={42} />
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte">{l.producto.nombre ?? l.producto.id}</Texto>
                  <Texto v="gris">
                    {l.cantidad} {nombreDe(l.presentacion as Presentacion, l.cantidad)} · {l.unidades} u.
                  </Texto>
                </View>
                <Texto v="fuerte">{pedido.total.centavos ? l.subtotal.texto : '—'}</Texto>
              </View>
            ))}
          </Tarjeta>
        </View>
      </ScrollView>
      <PagoExitoso visible={festejo} total={pedido.total.texto} alCerrar={() => setFestejo(false)} />
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  cabecera: { paddingHorizontal: 18, paddingBottom: 56, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, gap: 14 },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  atras: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201,244,90,0.14)' },
  atrasClaro: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.superficie },
  codigo: { flex: 1, fontFamily: FUENTE.fuerte, fontSize: 13, color: '#CFE3D6' },
  filaTitular: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entregado: { width: 110, height: 110, marginVertical: -14 },
  titular: { fontFamily: FUENTE.negra, fontSize: 28, lineHeight: 33, color: '#fff', letterSpacing: -0.8 },
  detalleTitular: { fontFamily: FUENTE.semi, fontSize: 15, color: COLOR.lima, marginTop: 4 },
  cuerpo: { paddingHorizontal: 16, gap: 14, marginTop: -40 },
  tarjetaLinea: { padding: 16, borderRadius: 26, backgroundColor: COLOR.superficie, shadowColor: '#182D25', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deshecho: { gap: 8, padding: 14, borderRadius: 20, backgroundColor: COLOR.verdeSuave },
});
