import { useEspacioBarra } from '../BarraInferior';
import { bs, comprables, nombreCorto, opcionesDeCompra, ordenarMayoristas, precioDesde, rubros, tinte, type Producto } from '@abasto/comercio';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Esqueleto, Flotar, Tocable } from '../animacion';
import { BotonMas, Falla, Icono, Iniciales, Insignia, Seccion, SinPrecio, Texto } from '../componentes';
import { useDirecciones } from '../direcciones-estado';
import { useEstado } from '../estado';
import { CabeceraInicio } from '../CabeceraInicio';
import { HojaDeDirecciones } from '../HojaDeDirecciones';
import { ILUSTRACION, imagenDeRubro, rubroCorto } from '../ilustraciones';
import type { PantallaDePestana } from '../navegacion';
import { useSesion } from '../sesion';
import { CABECERA, COLOR, FUENTE, SOMBRA, TINTES } from '../tema';
import { useVuelo, type Origen } from '../vuelo';

interface Banner {
  titulo: string;
  detalle: string;
  boton: string;
  imagen: number;
  rubro: string | null;
  fondo: [string, string];
}

const BANNERS: Banner[] = [
  { titulo: 'Compra por caja\no fardo', detalle: 'Mejores precios para tu negocio', boton: 'Ver ofertas', imagen: ILUSTRACION.bannerAbarrotes, rubro: 'Abarrotes', fondo: [COLOR.lima, COLOR.limaFuerte] },
  { titulo: 'Pide hoy,\nte lo llevamos', detalle: 'A tu tienda o a tu casa', boton: 'Ver productos', imagen: ILUSTRACION.bannerEntrega, rubro: null, fondo: ['#FFD48C', COLOR.ambar] },
  { titulo: 'Bebidas\npor caja', detalle: 'Gaseosas, agua y jugos', boton: 'Ver bebidas', imagen: ILUSTRACION.bannerBebidas, rubro: 'Bebidas', fondo: [COLOR.limaMedia, COLOR.lima] },
  { titulo: 'Limpieza\npara el hogar', detalle: 'Detergentes, jabones y más', boton: 'Ver limpieza', imagen: ILUSTRACION.bannerLimpieza, rubro: 'Limpieza del hogar', fondo: ['#FFFFFF', COLOR.limaSuave] },
];

/** Inicio de ABASTO: encabezado bosque, tarjeta protagonista lima con el 3D que sale de sus bordes, rubros y ofertas. */
export function Inicio({ navigation }: PantallaDePestana<'Inicio'>) {
  const { usuario } = useSesion();
  const { catalogo, enLinea, agregarRapido } = useEstado();
  const { elegida, porConfirmar } = useDirecciones();
  const [hoja, setHoja] = useState(false);
  const arriba = useSafeAreaInsets().top;
  const enFoco = useIsFocused();
  const espacio = useEspacioBarra();
  const bajada = useRef(new Animated.Value(0)).current;

  // Al abrir la app se confirma la dirección una vez
  useEffect(() => {
    if (porConfirmar) {
      const t = setTimeout(() => setHoja(true), 450);
      return () => clearTimeout(t);
    }
  }, [porConfirmar]);

  const productos = comprables(catalogo.productos);
  const ofertas = [...productos].sort((a, b) => Number(b.precioVisible) - Number(a.precioVisible)).slice(0, 10);
  const porCaja = productos.filter((p) => p.precioVisible && p.escalas.some((e) => e.presentacion === 'CAJA' || e.presentacion === 'FARDO')).slice(0, 5);
  const vendedores = ordenarMayoristas(catalogo.mayoristas);
  const losRubros = rubros(catalogo.productos);
  const cuantos = (id: string) => productos.filter((p) => p.mayorista.id === id).length;
  const abrir = (p: Producto) => navigation.navigate('Producto', { id: p.id });
  const cargandoPrimeraVez = catalogo.cargando && !productos.length;

  return (
    <View style={e.pantalla}>
      {enFoco && <StatusBar style="light" />}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: bajada } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: espacio }}
        refreshControl={<RefreshControl refreshing={catalogo.cargando && productos.length > 0} onRefresh={() => void catalogo.recargar()} tintColor={COLOR.lima} colors={[COLOR.bosque]} />}
      >
        <CabeceraInicio
          direccion={elegida}
          alCambiarDireccion={() => setHoja(true)}
          alBuscar={() => navigation.navigate('Buscar')}
          alBuscarConFoto={() => navigation.navigate('BuscarPorFoto')}
          alVerPedidos={() => navigation.navigate('Pedidos')}
        />

        {!enLinea && <AvisoSinSenal />}

        <View style={e.cuerpo}>
          {!!usuario?.nombre && (
            <Aparecer>
              <Texto v="t2">Hola, {usuario.nombre.split(' ')[0]} 👋</Texto>
            </Aparecer>
          )}

          <Aparecer orden={1}>
            <Carrusel alTocar={(b) => navigation.navigate('Buscar', b.rubro ? { rubro: b.rubro } : undefined)} />
          </Aparecer>

          {catalogo.error && !productos.length && <Falla texto={catalogo.error} />}

          <Aparecer orden={2}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.filaRubros}>
              {cargandoPrimeraVez
                ? [0, 1, 2, 3].map((i) => <Esqueleto key={i} alto={112} ancho={92} radio={22} />)
                : losRubros.map((r) => (
                    <Tocable key={r} onPress={() => navigation.navigate('Buscar', { rubro: r })} style={e.rubro} accessibilityRole="button" accessibilityLabel={r}>
                      <Image source={imagenDeRubro(r)} style={e.imagenRubro} contentFit="contain" transition={250} />
                      <Texto style={e.textoRubro} lineas={1}>
                        {rubroCorto(r)}
                      </Texto>
                    </Tocable>
                  ))}
            </ScrollView>
          </Aparecer>

          <Aparecer orden={3}>
            <Tocable onPress={() => navigation.navigate('Pedidos')} style={e.otraVez} accessibilityRole="button">
              <Image source={ILUSTRACION.comprarOtraVez} style={{ width: 64, height: 64 }} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <Texto v="t3">Comprar otra vez</Texto>
                <Texto v="gris">Repite lo que pides siempre, en un toque.</Texto>
              </View>
              <View style={e.flecha}>
                <Icono nombre="arrow-forward" tamano={18} color={COLOR.bosque} />
              </View>
            </Tocable>
          </Aparecer>

          <Aparecer orden={4}>
            <Seccion titulo="Ofertas de la semana" enlace="Ver todas →" alTocarEnlace={() => navigation.navigate('Buscar')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.filaOfertas}>
                {cargandoPrimeraVez
                  ? [0, 1, 2].map((i) => <Esqueleto key={i} alto={250} ancho={168} radio={22} />)
                  : ofertas.map((p, i) => <TarjetaDeOferta key={p.id} producto={p} orden={i} alAbrir={() => abrir(p)} alAgregar={agregarRapido} />)}
              </ScrollView>
            </Seccion>
          </Aparecer>

          {porCaja.length > 0 && (
            <Aparecer orden={5}>
              <Seccion titulo="Conviene por caja">
                {porCaja.map((p) => {
                  const grande = p.escalas.find((x) => x.presentacion === 'CAJA' || x.presentacion === 'FARDO')!;
                  return (
                    <Tocable key={p.id} hundir={0.98} conVibracion={false} onPress={() => abrir(p)} style={e.porCaja}>
                      <View style={[e.miniatura, { backgroundColor: TINTES[tinte(p.rubro)] }]}>
                        <Image source={imagenDeRubro(p.rubro)} style={{ width: 54, height: 54 }} contentFit="contain" />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Texto v="fuerte" lineas={1}>
                          {p.nombre}
                        </Texto>
                        <Texto v="gris">
                          {grande.presentacion.toLowerCase()} de {grande.cantidad} u. · {nombreCorto(p.mayorista.nombre)}
                        </Texto>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Texto v="precio">{bs((grande.precioUnitario?.centavos ?? 0) * grande.cantidad)}</Texto>
                        <Texto v="chico">{grande.precioUnitario?.texto} c/u</Texto>
                      </View>
                    </Tocable>
                  );
                })}
              </Seccion>
            </Aparecer>
          )}

          {vendedores.length > 0 && (
            <Aparecer orden={6}>
              <Seccion titulo="Mayoristas" enlace="Ver todos →" alTocarEnlace={() => navigation.navigate('Buscar', { modo: 'vendedores' })}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16, paddingBottom: 8 }}>
                  {vendedores.map((m) => (
                    <Tocable key={m.id} hundir={0.97} conVibracion={false} onPress={() => navigation.navigate('Vendedor', { id: m.id })} style={e.vendedor}>
                      <View style={e.filaChica}>
                        <Iniciales nombre={m.nombre} oscuro={m.deLaCasa} />
                        <Texto v="fuerte" lineas={2} style={{ flex: 1 }}>
                          {m.nombre}
                        </Texto>
                      </View>
                      <Texto v="gris">{cuantos(m.id)} productos</Texto>
                      {m.deLaCasa ? <Insignia texto="Precios para todos" /> : m.relacion === 'APROBADA' ? <Insignia texto="Eres cliente" /> : <Insignia texto="Verificado" color="gris" />}
                    </Tocable>
                  ))}
                </ScrollView>
              </Seccion>
            </Aparecer>
          )}
        </View>
      </Animated.ScrollView>

      {/* Franja bosque detrás de la barra de estado: al bajar, la hora sigue viéndose en blanco */}
      <Animated.View pointerEvents="none" style={[e.franja, { height: arriba, opacity: bajada.interpolate({ inputRange: [40, 110], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />

      <HojaDeDirecciones
        visible={hoja}
        alCerrar={() => setHoja(false)}
        alNueva={() => {
          setHoja(false);
          navigation.navigate('NuevaDireccion');
        }}
      />
    </View>
  );
}

/** El descuento por volumen de la mejor presentación («-5 %»), o null si no hay. */
function descuento(p: Producto): string | null {
  const mejor = [...opcionesDeCompra(p)].reverse().find((o) => o.ahorra);
  const n = mejor?.ahorro.match(/\d+/)?.[0];
  return n ? `-${n} %` : null;
}

function TarjetaDeOferta({ producto: p, orden, alAbrir, alAgregar }: { producto: Producto; orden: number; alAbrir: () => void; alAgregar: (p: Producto) => void }) {
  const desde = precioDesde(p);
  const rebaja = descuento(p);
  const foto: Origen = useRef(null);
  const volar = useVuelo();
  return (
    <Tocable hundir={0.97} conVibracion={false} onPress={alAbrir} style={e.oferta}>
      <View ref={foto} style={[e.fotoOferta, { backgroundColor: TINTES[tinte(p.rubro)] }]}>
        <Flotar alto={4} duracion={3000} retraso={orden * 220}>
          <Image source={imagenDeRubro(p.rubro)} style={e.imagenOferta} contentFit="contain" transition={250} />
        </Flotar>
        {rebaja && (
          <View style={e.rebaja}>
            <Texto style={e.textoRebaja}>{rebaja}</Texto>
          </View>
        )}
      </View>
      <Texto v="fuerte" lineas={2} style={{ minHeight: 38 }}>
        {p.nombre}
      </Texto>
      <Texto v="chico" lineas={1}>
        {nombreCorto(p.mayorista.nombre)}
      </Texto>
      <View style={e.pie}>
        {desde ? (
          <>
            <View>
              <Texto v="precio">{desde.precioUnitario!.texto}</Texto>
              <Texto v="chico">c/u por {desde.presentacion.toLowerCase()}</Texto>
            </View>
            <BotonMas
              producto={p}
              alAgregar={(x) => {
                volar(foto, imagenDeRubro(x.rubro));
                alAgregar(x);
              }}
            />
          </>
        ) : (
          <SinPrecio />
        )}
      </View>
    </Tocable>
  );
}

/** La tarjeta protagonista: lima (y sus variantes), con el 3D flotando por encima de sus bordes; pasa sola cada 5 s. */
function Carrusel({ alTocar }: { alTocar: (b: Banner) => void }) {
  const { width } = useWindowDimensions();
  const ancho = width - 32;
  const lista = useRef<FlatList<Banner>>(null);
  const [actual, setActual] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setActual((i) => {
        const siguiente = (i + 1) % BANNERS.length;
        lista.current?.scrollToOffset({ offset: siguiente * (ancho + 12), animated: true });
        return siguiente;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [ancho]);
  return (
    <View style={{ gap: 10 }}>
      <FlatList
        ref={lista}
        data={BANNERS}
        horizontal
        snapToInterval={ancho + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.titulo}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingTop: 30 }}
        style={{ marginTop: -30 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onMomentumScrollEnd={(ev) => setActual(Math.round(ev.nativeEvent.contentOffset.x / (ancho + 12)))}
        renderItem={({ item }) => (
          <Tocable hundir={0.98} onPress={() => alTocar(item)} style={{ width: ancho, height: 184 }} accessibilityRole="button" accessibilityLabel={item.titulo.replace('\n', ' ')}>
            <LinearGradient colors={item.fondo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={e.banner}>
              <View style={e.textoBanner}>
                <Texto style={e.tituloBanner}>{item.titulo}</Texto>
                <Texto style={{ color: COLOR.bosqueMedio, fontSize: 13 }}>{item.detalle}</Texto>
                <View style={e.botonBanner}>
                  <Texto style={{ color: '#fff', fontFamily: FUENTE.fuerte, fontSize: 13 }}>{item.boton}</Texto>
                  <Icono nombre="arrow-forward" tamano={14} color={COLOR.lima} />
                </View>
              </View>
            </LinearGradient>
            {/* El 3D va afuera del degradado para poder salirse por arriba y por la derecha */}
            <Flotar alto={8} style={e.objetoBanner}>
              <Image source={item.imagen} style={{ width: '100%', height: '100%' }} contentFit="contain" transition={250} />
            </Flotar>
          </Tocable>
        )}
      />
      <View style={e.puntos}>
        {BANNERS.map((b, i) => (
          <View key={b.titulo} style={[e.punto, i === actual && e.puntoActivo]} />
        ))}
      </View>
    </View>
  );
}

export function AvisoSinSenal() {
  return (
    <View style={e.sinSenal} accessibilityRole="alert">
      <Image source={ILUSTRACION.sinSenal} style={{ width: 46, height: 46 }} contentFit="contain" />
      <View style={{ flex: 1 }}>
        <Texto v="fuerte" style={{ color: COLOR.ambarTexto }}>
          Sin conexión
        </Texto>
        <Texto style={{ color: COLOR.ambarTexto, fontSize: 12.5 }}>Ves lo que tienes guardado. Tus pedidos salen cuando vuelva la señal.</Texto>
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  franja: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: CABECERA.oscuro },
  filaChica: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cuerpo: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 22 },
  banner: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  textoBanner: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, gap: 4, maxWidth: '58%' },
  tituloBanner: { fontFamily: FUENTE.negra, fontSize: 23, lineHeight: 27, color: COLOR.bosque, letterSpacing: -0.5 },
  botonBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: COLOR.bosque, paddingHorizontal: 14, height: 36, borderRadius: 18, marginTop: 10 },
  objetoBanner: { position: 'absolute', right: -10, top: -30, width: '54%', height: 214 },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLOR.borde },
  puntoActivo: { width: 24, backgroundColor: COLOR.bosque },
  filaRubros: { gap: 12, paddingRight: 16, paddingBottom: 8 },
  rubro: { width: 92, height: 112, borderRadius: 22, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center', gap: 4, ...SOMBRA },
  imagenRubro: { width: 68, height: 68 },
  textoRubro: { fontFamily: FUENTE.fuerte, fontSize: 12.5, color: COLOR.texto },
  otraVez: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 24, backgroundColor: COLOR.superficie, ...SOMBRA },
  flecha: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  filaOfertas: { gap: 12, paddingRight: 16, paddingTop: 4, paddingBottom: 8 },
  oferta: { width: 168, gap: 4, padding: 10, borderRadius: 24, backgroundColor: COLOR.superficie, ...SOMBRA },
  fotoOferta: { height: 122, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  imagenOferta: { width: 106, height: 106 },
  rebaja: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 9, height: 26, borderRadius: 13, backgroundColor: COLOR.ambar, alignItems: 'center', justifyContent: 'center' },
  textoRebaja: { fontFamily: FUENTE.negra, fontSize: 12, color: COLOR.bosque },
  pie: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, marginTop: 'auto' },
  porCaja: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 10, borderRadius: 22, backgroundColor: COLOR.superficie, ...SOMBRA },
  miniatura: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vendedor: { width: 176, gap: 6, padding: 12, borderRadius: 22, backgroundColor: COLOR.superficie, ...SOMBRA },
  sinSenal: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 18, backgroundColor: COLOR.ambarSuave },
});
