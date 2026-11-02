/**
 * El seguimiento como experiencia (02/11, pedido de Andrés: «como PedidosYa pero con identidad propia»):
 * - `LineaDeTiempo`: los pasos de la saga arriba; el paso actual late con ondas (algo está pasando) y, si es el pago
 *   por QR, muestra el QR ahí mismo para pagar sin ir a otra pantalla.
 * - `PagoExitoso`: al pagar, un festejo a pantalla completa (insignia 3D, confeti y vibración) que se cierra solo.
 * - `ProgresoChico`: los mismos pasos en una barrita, para la tarjeta de Compras.
 */
import { esPasoDePagoQr, porPagar, progresoDelPedido, tiempoRestante, type Paso, type Pedido } from '@abasto/comercio';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { vibrar } from './animacion';
import { Boton, Icono, Texto } from './componentes';
import { ILUSTRACION } from './ilustraciones';
import { COLOR, FUENTE } from './tema';

/** Dos ondas que salen del punto una tras otra: «esto está en curso» */
export function Pulso({ color = COLOR.lima, tamano = 30 }: { color?: string; tamano?: number }) {
  const ondas = useRef([new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    const animaciones = ondas.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    animaciones.forEach((a) => a.start());
    return () => animaciones.forEach((a) => a.stop());
  }, [ondas]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {ondas.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: tamano,
            height: tamano,
            borderRadius: tamano / 2,
            backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }) }],
          }}
        />
      ))}
    </View>
  );
}

const ICONO_DEL_PASO: Record<string, Parameters<typeof Icono>[0]['nombre']> = {
  'Pedido enviado': 'paper-plane',
  'Stock reservado': 'cube',
  'Reservando el stock': 'cube',
  'Reserva del stock': 'cube',
  'Pago por QR': 'qr-code',
  'Crédito con el mayorista': 'card',
  'Confirmación del mayorista': 'storefront',
  'En preparación': 'basket',
  'En camino': 'bicycle',
  Entregado: 'home',
};

/** Los pasos del pedido, de arriba abajo. El actual late; el pago por QR trae el QR para pagar ahí mismo. */
export function LineaDeTiempo({ pedido, pagando, alPagar }: { pedido: Pedido; pagando: boolean; alPagar: () => void }) {
  const { pasos, actual } = progresoDelPedido(pedido);
  return (
    <View accessibilityLabel="Línea de tiempo del pedido">
      {pasos.map((paso, i) => (
        <PasoDeLaLinea
          key={paso.nombre}
          paso={paso}
          esActual={i === actual}
          ultimo={i === pasos.length - 1}
          qr={i === actual && esPasoDePagoQr(paso) && porPagar(pedido) && pedido.cobro ? pedido.cobro : null}
          pagando={pagando}
          alPagar={alPagar}
        />
      ))}
    </View>
  );
}

function PasoDeLaLinea({
  paso,
  esActual,
  ultimo,
  qr,
  pagando,
  alPagar,
}: {
  paso: Paso;
  esActual: boolean;
  ultimo: boolean;
  qr: NonNullable<Pedido['cobro']> | null;
  pagando: boolean;
  alPagar: () => void;
}) {
  const hecho = paso.nodo === 'hecho';
  const rojo = paso.nodo === 'rojo';
  const icono = ICONO_DEL_PASO[paso.nombre] ?? 'ellipse';
  return (
    <View style={e.paso} accessibilityLabel={`${paso.nombre}${esActual ? ', en curso' : hecho ? ', hecho' : ''}`}>
      <View style={{ alignItems: 'center', width: 36 }}>
        <View style={e.lugarNodo}>
          {esActual && <Pulso color={rojo ? COLOR.rojo : COLOR.lima} tamano={34} />}
          <View style={[e.nodo, hecho && e.nodoHecho, esActual && e.nodoActual, rojo && e.nodoRojo]}>
            <Icono nombre={hecho ? 'checkmark' : rojo ? 'close' : icono} tamano={hecho || rojo ? 16 : 17} color={hecho ? COLOR.lima : rojo ? '#fff' : esActual ? COLOR.bosque : COLOR.texto3} />
          </View>
        </View>
        {!ultimo && <View style={[e.linea, hecho && e.lineaHecha]} />}
      </View>
      <View style={{ flex: 1, paddingBottom: ultimo ? 0 : 14, gap: 2 }}>
        <Texto style={[e.nombrePaso, paso.nodo === 'pend' && !esActual && e.nombrePendiente, esActual && e.nombreActual, rojo && { color: COLOR.rojoTexto }]}>{paso.nombre}</Texto>
        {!!paso.detalle && <Texto v="chico">{paso.detalle}</Texto>}
        {qr && <QrParaPagar cobro={qr} pagando={pagando} alPagar={alPagar} />}
      </View>
    </View>
  );
}

/** El QR del pedido, dentro de su paso. En la demo no se cobra: «Simular pago» hace lo que haría el banco */
function QrParaPagar({ cobro, pagando, alPagar }: { cobro: NonNullable<Pedido['cobro']>; pagando: boolean; alPagar: () => void }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    // El reloj del vencimiento: es la cuenta regresiva en pantalla, no trae datos
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);
  return (
    <View style={e.cajaQr}>
      <View style={e.marcoQr} accessibilityLabel="Código QR del pedido">
        <QRCode value={cobro.codigo} size={190} color={COLOR.bosque} />
      </View>
      <Texto style={e.montoQr}>{cobro.monto.texto}</Texto>
      <View style={e.vence}>
        <Icono nombre="time-outline" tamano={14} color={COLOR.ambarTexto} />
        <Texto style={{ color: COLOR.ambarTexto, fontFamily: FUENTE.fuerte, fontSize: 13 }}>Vence en {tiempoRestante(cobro.venceEn, ahora)}</Texto>
      </View>
      <Texto v="chico" style={{ textAlign: 'center' }}>
        Escanéalo con la app de tu banco o tu billetera. Es un QR de demostración: no se cobra nada.
      </Texto>
      <View style={{ alignSelf: 'stretch' }}>
        <Boton tipo="oscuro" texto={pagando ? 'Verificando el pago…' : 'Simular pago (demo)'} icono="checkmark-circle" cargando={pagando} alTocar={alPagar} />
      </View>
    </View>
  );
}

/** La barrita de Compras: un punto por paso, hechos en bosque y el actual latiendo */
export function ProgresoChico({ pedido }: { pedido: Pedido }) {
  const { pasos, actual } = progresoDelPedido(pedido);
  return (
    <View style={e.barrita} accessibilityLabel={`Paso ${Math.max(actual, 0) + 1} de ${pasos.length}`}>
      {pasos.map((x, i) => (
        <View key={x.nombre} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={[e.puntito, x.nodo === 'hecho' && { backgroundColor: COLOR.bosque }, x.nodo === 'rojo' && { backgroundColor: COLOR.rojo }, i === actual && { backgroundColor: COLOR.lima }]}>
            {i === actual && <Pulso tamano={10} />}
          </View>
          {i < pasos.length - 1 && <View style={[e.tramo, x.nodo === 'hecho' && { backgroundColor: COLOR.bosque }]} />}
        </View>
      ))}
    </View>
  );
}

const CONFETI = Array.from({ length: 18 }, (_, i) => ({
  angulo: (i / 18) * Math.PI * 2,
  distancia: 120 + (i % 3) * 40,
  color: [COLOR.lima, COLOR.ambar, '#FFFFFF'][i % 3],
  lado: 8 + (i % 4) * 3,
}));

/** El festejo del pago: cubre toda la pantalla, la insignia salta, el confeti explota y se cierra solo */
export function PagoExitoso({ visible, total, alCerrar }: { visible: boolean; total: string; alCerrar: () => void }) {
  const entrada = useRef(new Animated.Value(0)).current;
  const estallido = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return undefined;
    entrada.setValue(0);
    estallido.setValue(0);
    vibrar.exito();
    Animated.parallel([
      Animated.spring(entrada, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 14 }),
      Animated.timing(estallido, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const t = setTimeout(alCerrar, 2800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={alCerrar} statusBarTranslucent>
      <Pressable style={e.festejo} onPress={alCerrar} accessibilityRole="button" accessibilityLabel="Pago recibido. Toca para ver tu pedido">
        <View style={e.centro}>
          {CONFETI.map((c, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                width: c.lado,
                height: c.lado,
                borderRadius: c.lado / 2,
                backgroundColor: c.color,
                opacity: estallido.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: estallido.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(c.angulo) * c.distancia] }) },
                  { translateY: estallido.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(c.angulo) * c.distancia] }) },
                ],
              }}
            />
          ))}
          <Animated.View
            style={{
              transform: [
                { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                { rotate: entrada.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
              ],
            }}
          >
            <Image source={ILUSTRACION.pagoExitoso} style={{ width: 230, height: 230 }} contentFit="contain" />
          </Animated.View>
        </View>
        <Animated.View style={{ alignItems: 'center', gap: 6, opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
          <Texto style={e.tituloFestejo}>¡Pago recibido!</Texto>
          <Texto style={e.detalleFestejo}>Pagaste {total}. Ya avisamos al vendedor para que prepare tu pedido.</Texto>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const e = StyleSheet.create({
  paso: { flexDirection: 'row', gap: 12 },
  lugarNodo: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  nodo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.tenue, borderWidth: 2, borderColor: COLOR.borde },
  nodoHecho: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  nodoActual: { backgroundColor: COLOR.lima, borderColor: COLOR.bosque },
  nodoRojo: { backgroundColor: COLOR.rojo, borderColor: COLOR.rojo },
  linea: { width: 3, flex: 1, minHeight: 14, borderRadius: 2, backgroundColor: COLOR.borde, marginVertical: 2 },
  lineaHecha: { backgroundColor: COLOR.bosque },
  nombrePaso: { fontFamily: FUENTE.fuerte, fontSize: 15, color: COLOR.texto, marginTop: 6 },
  nombrePendiente: { color: COLOR.texto3, fontFamily: FUENTE.semi },
  nombreActual: { fontFamily: FUENTE.negra, fontSize: 17, color: COLOR.bosque },
  cajaQr: { alignItems: 'center', gap: 8, marginTop: 10, padding: 14, borderRadius: 22, backgroundColor: COLOR.limaSuave, borderWidth: 1.5, borderColor: COLOR.lima },
  marcoQr: { padding: 12, borderRadius: 18, backgroundColor: '#fff' },
  montoQr: { fontFamily: FUENTE.negra, fontSize: 28, color: COLOR.bosque, letterSpacing: -0.6 },
  vence: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: COLOR.ambarSuave },
  barrita: { flexDirection: 'row', alignItems: 'center' },
  puntito: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLOR.borde },
  tramo: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLOR.borde, marginHorizontal: 2 },
  festejo: { flex: 1, backgroundColor: 'rgba(24,45,37,0.96)', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 28 },
  centro: { alignItems: 'center', justifyContent: 'center', width: 300, height: 300 },
  tituloFestejo: { fontFamily: FUENTE.negra, fontSize: 34, color: COLOR.lima, letterSpacing: -1 },
  detalleFestejo: { fontFamily: FUENTE.semi, fontSize: 16, color: '#E4EFDF', textAlign: 'center', lineHeight: 22 },
});
