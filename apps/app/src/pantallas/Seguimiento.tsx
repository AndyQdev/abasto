import { Image } from 'expo-image';
import { Flotar } from '../animacion';
import { ILUSTRACION } from '../ilustraciones';
import {
  compensaciones,
  estadoVisible,
  fechaHora,
  lineaDeTiempo,
  nombreDe,
  PAGAR_QR_DE_PRUEBA,
  porPagar,
  productos as cuantos,
  tiempoRestante,
  UN_PEDIDO,
  type Pedido,
  type Presentacion,
} from '@abasto/comercio';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { graphql } from '../api';
import { Boton, colorDeClase, Falla, Foto, Icono, Iniciales, Insignia, Tarjeta, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import type { PantallaDePila } from '../navegacion';
import { MapaChico } from '../Mapa';
import { COLOR } from '../tema';
import { unaALaVez, useAvisosDePedidos } from '../tiempo-real';

const PAGO = { QR: 'Pago por QR', CREDITO: 'Crédito', CONTRA_ENTREGA: 'Contra entrega' } as const;

/** Un pedido y su saga paso a paso. Se actualiza en tiempo real: cuando Conecta avisa que este pedido cambió (02/11). */
export function Seguimiento({ route, navigation }: PantallaDePila<'Seguimiento'>) {
  const { enLinea } = useEstado();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verQr, setVerQr] = useState(false);
  const [pagando, setPagando] = useState(false);
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

  useEffect(() => {
    if (pedido) navigation.setOptions({ title: `Pedido #${pedido.codigo}` });
  }, [pedido, navigation]);

  if (!pedido) {
    return (
      <View style={[e.pantalla, { padding: 16 }]}>
        {error ? <Falla texto={error} /> : <Vacio titulo={enLinea ? 'Cargando el pedido…' : 'Necesitas conexión para ver el seguimiento'} />}
      </View>
    );
  }

  if (verQr && pedido.cobro && porPagar(pedido)) {
    return (
      <PagoQr
        pedido={pedido}
        pagando={pagando}
        alVolver={() => setVerQr(false)}
        alPagar={async () => {
          setPagando(true);
          try {
            await graphql(PAGAR_QR_DE_PRUEBA, { id });
            setVerQr(false);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setPagando(false);
          }
        }}
      />
    );
  }

  const estado = estadoVisible(pedido);
  const deshecho = compensaciones(pedido);
  const vendedor = pedido.mayorista.nombre ?? pedido.mayorista.id;

  return (
    <SafeAreaView style={e.pantalla} edges={['bottom']}>
      <ScrollView contentContainerStyle={e.contenido}>
        {/* La ilustración cuenta en qué va: cajas listas, en camino o entregado */}
        <Flotar alto={6} style={{ alignSelf: 'center' }}>
          <Image
            source={pedido.estado === 'ENTREGADO' ? ILUSTRACION.pedidoEntregado : pedido.estado === 'DESPACHADO' ? ILUSTRACION.pedidoEnCamino : ILUSTRACION.vacioPedidos}
            style={{ width: 200, height: 200 }}
            contentFit="contain"
            transition={300}
          />
        </Flotar>
        <Insignia texto={estado.texto} color={colorDeClase(estado.clase)} />
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
              <MapaChico punto={{ latitud: pedido.entrega.latitud, longitud: pedido.entrega.longitud }} alto={120} />
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

        {error && <Falla texto={error} />}
        {porPagar(pedido) && <Boton texto={`Pagar con QR · ${pedido.total.texto}`} icono="qr-code-outline" alTocar={() => setVerQr(true)} />}

        <Tarjeta style={{ gap: 2 }}>
          <Texto v="t3" style={{ marginBottom: 8 }}>
            Estado del pedido
          </Texto>
          {lineaDeTiempo(pedido).map((paso, i, todos) => (
            <View key={paso.nombre} style={e.paso}>
              <View style={{ alignItems: 'center' }}>
                <View style={[e.nodo, NODOS[paso.nodo]]}>
                  {paso.nodo === 'hecho' && <Icono nombre="checkmark" tamano={14} color="#fff" />}
                  {paso.nodo === 'rojo' && <Icono nombre="close" tamano={14} color="#fff" />}
                </View>
                {i < todos.length - 1 && <View style={[e.linea, paso.nodo === 'hecho' && { backgroundColor: COLOR.verde }]} />}
              </View>
              <View style={{ flex: 1, paddingBottom: 12 }}>
                <Texto v="fuerte" style={[paso.nodo === 'pend' && { color: COLOR.texto3, fontWeight: '600' }, paso.nodo === 'rojo' && { color: COLOR.rojoTexto }]}>
                  {paso.nombre}
                </Texto>
                {paso.detalle && <Texto v="gris">{paso.detalle}</Texto>}
              </View>
            </View>
          ))}
        </Tarjeta>

        {deshecho.length > 0 && (
          <View style={e.deshecho}>
            <Texto v="t3">Lo deshicimos por ti</Texto>
            <Texto style={{ color: COLOR.texto2 }}>Como el pedido no siguió, revertimos lo que se había hecho.</Texto>
            <Tarjeta style={{ gap: 8 }}>
              {deshecho.map((d) => (
                <View key={d} style={e.entre}>
                  <Texto style={{ flex: 1 }}>{d}</Texto>
                  <Insignia texto="Hecho" />
                </View>
              ))}
            </Tarjeta>
          </View>
        )}

        <Tarjeta style={{ gap: 10 }}>
          <Texto v="t3">Productos</Texto>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const NODOS = {
  hecho: { backgroundColor: COLOR.verde },
  proc: { backgroundColor: COLOR.ambarSuave, borderWidth: 2, borderColor: COLOR.ambar },
  pend: { backgroundColor: COLOR.superficie, borderWidth: 2, borderColor: COLOR.borde },
  rojo: { backgroundColor: COLOR.rojo },
} as const;

/** El QR del pedido. En la demo no se cobra: «Simular pago» hace lo que haría el banco. */
function PagoQr({ pedido, pagando, alPagar, alVolver }: { pedido: Pedido; pagando: boolean; alPagar: () => void; alVolver: () => void }) {
  const cobro = pedido.cobro!;
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);
  return (
    <SafeAreaView style={e.pantalla} edges={['bottom']}>
      <ScrollView contentContainerStyle={[e.contenido, { alignItems: 'center' }]}>
        <Texto v="gris">Pagas a</Texto>
        <Texto v="fuerte">{pedido.mayorista.nombre ?? pedido.mayorista.id}</Texto>
        <Texto v="gris">Total a pagar</Texto>
        <Texto v="t1" style={{ fontSize: 34 }}>
          {cobro.monto.texto}
        </Texto>
        <View style={e.marcoQr} accessibilityLabel="Código QR del pedido">
          <QRCode value={cobro.codigo} size={220} />
        </View>
        <Texto v="gris" style={{ textAlign: 'center', maxWidth: 300 }}>
          Escanea con la app de tu banco o tu billetera. Es un QR de demostración: no se cobra nada.
        </Texto>
        <Insignia texto={`Esperando pago · vence en ${tiempoRestante(cobro.venceEn, ahora)}`} color="ambar" />
        <View style={{ alignSelf: 'stretch', gap: 10 }}>
          <Boton texto={pagando ? 'Verificando el pago…' : 'Simular pago (demo)'} cargando={pagando} alTocar={alPagar} />
          <Boton tipo="secundario" texto="Volver al pedido" alTocar={alVolver} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 14, paddingBottom: 32 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paso: { flexDirection: 'row', gap: 12 },
  nodo: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  linea: { width: 2, flex: 1, minHeight: 16, backgroundColor: COLOR.borde },
  deshecho: { gap: 10, padding: 14, borderRadius: 20, backgroundColor: COLOR.verdeSuave },
  marcoQr: { padding: 16, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: COLOR.borde },
});
