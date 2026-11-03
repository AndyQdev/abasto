/**
 * Los dos festejos a pantalla completa (02/11, pedido de Andrés: «que la app tenga efectos para que se entienda desde
 * el primer día»):
 * - `PagoExitoso`: al pagar con QR. Rayos de luz que giran, onda expansiva, la insignia salta, el confeti estalla y cae,
 *   el monto sube contando, suena «¡cha-ching!» y vibra. Se cierra solo.
 * - `CompraEntregada`: la primera vez que se ve una compra entregada. Fanfarria, «¡Llegó tu compra! Muchas gracias…» y
 *   los productos vuelan uno por uno al estante del inventario con su contador. Después lleva a «Mi negocio».
 */
import { bs, type TipoDeNegocio } from '@abasto/comercio';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vibrar } from './animacion';
import { Boton, Foto, Texto } from './componentes';
import { ILUSTRACION } from './ilustraciones';
import { sonar } from './sonidos';
import { COLOR, FUENTE } from './tema';

// ---------------------------------------------------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------------------------------------------------

/** Rayos de luz que giran lento detrás de lo que se festeja */
function Rayos({ color = 'rgba(201,244,90,0.07)', tamano = 560 }: { color?: string; tamano?: number }) {
  const giro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(giro, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [giro]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
    >
      {/* Cada rayo sale del centro hacia afuera (no lo cruza): así el centro no se tapa de luz */}
      {Array.from({ length: 16 }, (_, i) => (
        <View key={i} style={{ position: 'absolute', width: tamano, height: tamano, alignItems: 'center', transform: [{ rotate: `${i * 22.5}deg` }] }}>
          <View style={{ width: 0, height: 0, borderLeftWidth: 22, borderRightWidth: 22, borderTopWidth: tamano / 2 - 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color }} />
        </View>
      ))}
    </Animated.View>
  );
}

const PAPELES = Array.from({ length: 36 }, (_, i) => ({
  angulo: (i / 36) * Math.PI * 2 + (i % 2 ? 0.08 : -0.08),
  distancia: 110 + (i % 5) * 34,
  color: [COLOR.lima, COLOR.ambar, '#FFFFFF', COLOR.limaFuerte][i % 4],
  ancho: 7 + (i % 3) * 3,
  redondo: i % 3 === 0,
  giro: (i % 2 ? 1 : -1) * (240 + (i % 4) * 90),
}));

/** El confeti estalla desde el centro y después cae con la gravedad */
function Estallido({ v }: { v: Animated.Value }) {
  return (
    <>
      {PAPELES.map((c, i) => {
        const x = Math.cos(c.angulo) * c.distancia;
        const y = Math.sin(c.angulo) * c.distancia;
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: c.ancho,
              height: c.redondo ? c.ancho : c.ancho * 1.7,
              borderRadius: c.redondo ? c.ancho / 2 : 2,
              backgroundColor: c.color,
              opacity: v.interpolate({ inputRange: [0, 0.06, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, x, x * 1.15] }) },
                { translateY: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, y, y + 320] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.giro}deg`] }) },
              ],
            }}
          />
        );
      })}
    </>
  );
}

/** Confeti que llueve desde arriba sin parar (mientras dura el festejo de la entrega) */
function Lluvia({ alto }: { alto: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [v]);
  return (
    <>
      {PAPELES.slice(0, 22).map((c, i) => {
        const fase = Animated.modulo(Animated.add(v, (i * 0.37) % 1), 1);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -20,
              left: `${(i * 41) % 100}%`,
              width: c.ancho,
              height: c.ancho * 1.7,
              borderRadius: 2,
              backgroundColor: c.color,
              transform: [
                { translateY: fase.interpolate({ inputRange: [0, 1], outputRange: [0, alto + 40] }) },
                { translateX: fase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, i % 2 ? 18 : -18, 0] }) },
                { rotate: fase.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.giro * 2}deg`] }) },
              ],
            }}
          />
        );
      })}
    </>
  );
}

/** Un número que sube contando hasta `hasta` (centavos) */
function useContador(hasta: number, activo: boolean, ms = 900, demora = 250) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (!activo) {
      setValor(0);
      return undefined;
    }
    let paso = 0;
    const pasos = 24;
    let reloj: ReturnType<typeof setInterval> | null = null;
    const inicio = setTimeout(() => {
      reloj = setInterval(() => {
        paso += 1;
        // Frena al final (ease-out)
        setValor(Math.round(hasta * (1 - Math.pow(1 - paso / pasos, 3))));
        if (paso >= pasos && reloj) clearInterval(reloj);
      }, ms / pasos);
    }, demora);
    return () => {
      clearTimeout(inicio);
      if (reloj) clearInterval(reloj);
    };
  }, [hasta, activo, ms, demora]);
  return valor;
}

// ---------------------------------------------------------------------------------------------------------------------
// El pago
// ---------------------------------------------------------------------------------------------------------------------

/** El festejo del pago: cubre toda la pantalla, suena, vibra, la insignia salta, el confeti estalla y se cierra solo */
export function PagoExitoso({ visible, total, centavos, alCerrar }: { visible: boolean; total: string; centavos?: number; alCerrar: () => void }) {
  const entrada = useRef(new Animated.Value(0)).current;
  const estallido = useRef(new Animated.Value(0)).current;
  const onda = useRef(new Animated.Value(0)).current;
  const monto = useContador(centavos ?? 0, visible && centavos !== undefined);
  useEffect(() => {
    if (!visible) return undefined;
    entrada.setValue(0);
    estallido.setValue(0);
    onda.setValue(0);
    sonar('pago');
    vibrar.exito();
    const otra = setTimeout(() => vibrar.toque(), 260);
    Animated.parallel([
      Animated.spring(entrada, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 16 }),
      Animated.timing(estallido, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(onda, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const t = setTimeout(alCerrar, 3400);
    return () => {
      clearTimeout(t);
      clearTimeout(otra);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={alCerrar} statusBarTranslucent>
      <Pressable style={e.festejo} onPress={alCerrar} accessibilityRole="button" accessibilityLabel="Pago recibido. Toca para ver tu pedido">
        <View style={e.centro}>
          <Rayos />
          {[0, 1].map((i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                e.onda,
                {
                  opacity: onda.interpolate({ inputRange: [0, 1], outputRange: [0.8 - i * 0.3, 0] }),
                  transform: [{ scale: onda.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4 + i * 0.6] }) }],
                },
              ]}
            />
          ))}
          <Estallido v={estallido} />
          <Animated.View
            style={{
              transform: [
                { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                { rotate: entrada.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '0deg'] }) },
              ],
            }}
          >
            <Image source={ILUSTRACION.pagoExitoso} style={{ width: 230, height: 230 }} contentFit="contain" cachePolicy="memory-disk" priority="high" />
          </Animated.View>
        </View>
        <Animated.View style={{ alignItems: 'center', gap: 6, opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }}>
          <Texto style={e.tituloFestejo}>¡Pago recibido!</Texto>
          {centavos !== undefined && <Texto style={e.monto}>{bs(monto)}</Texto>}
          <Texto style={e.detalleFestejo}>Pagaste {total}. Ya avisamos al vendedor para que prepare tu pedido.</Texto>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// La entrega
// ---------------------------------------------------------------------------------------------------------------------

export interface ProductoQueLlego {
  id: string;
  nombre: string;
  rubro: string;
  foto?: string | null;
}

const DESTINO: Record<TipoDeNegocio, { donde: string; boton: string }> = {
  tienda: { donde: 'tu inventario', boton: 'Ver mi inventario' },
  productor: { donde: 'tus insumos', boton: 'Ver mis insumos' },
  hogar: { donde: 'tu despensa', boton: 'Ver mi despensa' },
};

const VUELA_CADA = 380;
const MAXIMO_A_LA_VISTA = 6;

/**
 * La compra llegó: fanfarria, gracias y los productos que vuelan al estante. Al terminar lleva solo a «Mi negocio»
 * (o antes, con el botón). «Seguir aquí» lo cierra sin ir.
 */
export function CompraEntregada({
  visible,
  codigo,
  productos,
  tipo,
  alIr,
  alCerrar,
}: {
  visible: boolean;
  codigo: string;
  productos: ProductoQueLlego[];
  tipo: TipoDeNegocio;
  alIr: () => void;
  alCerrar: () => void;
}) {
  const { height: altoPantalla } = useWindowDimensions();
  const abajo = useSafeAreaInsets().bottom;
  const entrada = useRef(new Animated.Value(0)).current;
  const estante = useRef(new Animated.Value(0)).current;
  const golpe = useRef(new Animated.Value(0)).current;
  const vista = productos.slice(0, MAXIMO_A_LA_VISTA);
  const vuelos = useRef(Array.from({ length: MAXIMO_A_LA_VISTA }, () => new Animated.Value(0))).current;
  const [entraron, setEntraron] = useState(0);
  const [listo, setListo] = useState(false);
  const destino = DESTINO[tipo];
  const total = productos.length;

  useEffect(() => {
    if (!visible) return undefined;
    entrada.setValue(0);
    estante.setValue(0);
    vuelos.forEach((v) => v.setValue(0));
    setEntraron(0);
    setListo(false);
    sonar('entrega');
    vibrar.exito();
    const relojes: ReturnType<typeof setTimeout>[] = [];
    Animated.spring(entrada, { toValue: 1, useNativeDriver: true, speed: 7, bounciness: 14 }).start();
    relojes.push(setTimeout(() => Animated.spring(estante, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 12 }).start(), 1100));
    // Cada producto vuela al estante; al caer, el estante salta, vibra y el contador sube
    vista.forEach((_, i) => {
      const sale = 1700 + i * VUELA_CADA;
      relojes.push(
        setTimeout(() => {
          Animated.timing(vuelos[i], { toValue: 1, duration: 620, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
            setEntraron((n) => n + 1);
            vibrar.toque();
            golpe.setValue(0);
            Animated.spring(golpe, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 18 }).start();
          });
        }, sale),
      );
    });
    const fin = 1700 + vista.length * VUELA_CADA + 700;
    relojes.push(
      setTimeout(() => {
        // Los que no se vieron volar (más de 6) entran de una
        setEntraron(total);
        setListo(true);
      }, fin),
    );
    // Lleva solo a «Mi negocio» para ver cómo quedó
    relojes.push(setTimeout(alIr, fin + 2600));
    return () => relojes.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const distancia = Math.min(230, altoPantalla * 0.26);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={alCerrar} statusBarTranslucent>
      <View style={[e.festejo, { justifyContent: 'space-between', paddingTop: 60, paddingBottom: abajo + 24 }]} accessibilityViewIsModal>
        <Lluvia alto={altoPantalla} />
        <Animated.View style={{ alignItems: 'center', gap: 6, opacity: entrada, transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Rayos tamano={420} />
            <Image source={ILUSTRACION.pedidoEntregado} style={{ width: 190, height: 190 }} contentFit="contain" cachePolicy="memory-disk" priority="high" accessibilityIgnoresInvertColors />
          </View>
          <Texto style={e.tituloFestejo}>¡Llegó tu compra!</Texto>
          <Texto style={e.detalleFestejo}>Muchas gracias por comprar en Abasto. Compra #{codigo}</Texto>
        </Animated.View>

        {/* Los productos, en fila, que caen al estante */}
        <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
          <View style={e.filaProductos}>
            {vista.map((p, i) => {
              const centro = (i - (vista.length - 1) / 2) * 58;
              return (
                <Animated.View
                  key={p.id}
                  style={{
                    opacity: vuelos[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                    transform: [
                      { translateX: vuelos[i].interpolate({ inputRange: [0, 1], outputRange: [0, -centro] }) },
                      { translateY: vuelos[i].interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, -36, distancia] }) },
                      { scale: vuelos[i].interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.15, 0.35] }) },
                      { rotate: vuelos[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? 25 : -25}deg`] }) },
                    ],
                  }}
                >
                  <Foto producto={p} alto={50} ancho={50} />
                </Animated.View>
              );
            })}
          </View>
          <Animated.View
            style={{
              alignItems: 'center',
              marginTop: distancia - 70,
              opacity: estante,
              transform: [
                { scale: Animated.multiply(estante, golpe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] })) },
                { translateY: estante.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
              ],
            }}
          >
            {/* La base del estante: un destino visible aunque la ilustración tarde en cargar */}
            <View style={e.baseEstante} />
            <Image source={ILUSTRACION.estanteInventario} style={{ width: 150, height: 150 }} contentFit="contain" cachePolicy="memory-disk" priority="high" accessibilityIgnoresInvertColors />
            <View style={e.contador} accessibilityLiveRegion="polite">
              <Texto style={e.textoContador}>
                {entraron === 0 ? `Cargando a ${destino.donde}…` : `+${entraron} ${entraron === 1 ? 'producto' : 'productos'} en ${destino.donde}`}
              </Texto>
            </View>
          </Animated.View>
        </View>

        <View style={{ alignSelf: 'stretch', gap: 8, opacity: listo ? 1 : 0.001 }} pointerEvents={listo ? 'auto' : 'none'}>
          <Boton texto={destino.boton} icono="arrow-forward" alTocar={alIr} />
          <Pressable onPress={alCerrar} accessibilityRole="button" style={{ alignItems: 'center', padding: 10 }}>
            <Texto style={{ color: '#CFE3D6', fontFamily: FUENTE.fuerte }}>Seguir aquí</Texto>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  festejo: { flex: 1, backgroundColor: 'rgba(24,45,37,0.97)', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 28, overflow: 'hidden' },
  centro: { alignItems: 'center', justifyContent: 'center', width: 300, height: 300 },
  onda: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: COLOR.lima },
  tituloFestejo: { fontFamily: FUENTE.negra, fontSize: 34, color: COLOR.lima, letterSpacing: -1, textAlign: 'center' },
  monto: { fontFamily: FUENTE.negra, fontSize: 40, color: '#FFFFFF', letterSpacing: -1 },
  detalleFestejo: { fontFamily: FUENTE.semi, fontSize: 16, color: '#E4EFDF', textAlign: 'center', lineHeight: 22 },
  filaProductos: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  baseEstante: { position: 'absolute', top: 18, width: 170, height: 120, borderRadius: 60, backgroundColor: 'rgba(201,244,90,0.16)' },
  contador: { marginTop: -6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: COLOR.lima },
  textoContador: { fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.bosque },
});
