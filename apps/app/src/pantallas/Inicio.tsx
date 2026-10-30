import { useEspacioBarra } from '../BarraInferior';
import { opcionesDeCompra, precioDesde, preciosDeLaCasa, rubros, separarContenido, tinte, type Producto } from '@abasto/comercio';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Esqueleto, Tocable } from '../animacion';
import { Falla, Icono, Texto } from '../componentes';
import { useDirecciones } from '../direcciones-estado';
import { useEstado } from '../estado';
import { CabeceraInicio } from '../CabeceraInicio';
import { HojaDeDirecciones } from '../HojaDeDirecciones';
import { fotoDe, ILUSTRACION, imagenDeRubro, rubroCorto } from '../ilustraciones';
import type { PantallaDePestana } from '../navegacion';
import { CABECERA, COLOR, FUENTE, SOMBRA, TINTES } from '../tema';
import { useVuelo, type Origen } from '../vuelo';

const COLUMNAS = 3;
const SEPARACION = 8;

/**
 * Inicio de ABASTO (31/10): lo primero que se ve son los productos y sus precios por mayor. Encabezado compacto,
 * rubros y la grilla de lo que vende Abasto, del precio por unidad más bajo al más alto. Cada tarjeta muestra el
 * precio de la presentación más grande («Bs 6,50 c/u llevando 12»): al entrar se ven las demás presentaciones.
 */
export function Inicio({ navigation }: PantallaDePestana<'Inicio'>) {
  const { catalogo, enLinea, agregarRapido } = useEstado();
  const { elegida, porConfirmar } = useDirecciones();
  const [hoja, setHoja] = useState(false);
  const arriba = useSafeAreaInsets().top;
  const { width } = useWindowDimensions();
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

  const productos = preciosDeLaCasa(catalogo.productos);
  const losRubros = rubros(catalogo.productos);
  const cargandoPrimeraVez = catalogo.cargando && !catalogo.productos.length;
  const anchoTarjeta = (width - 32 - SEPARACION * (COLUMNAS - 1)) / COLUMNAS;
  const anchoRubro = (width - 32 - 10 * 3) / 4;

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
          {catalogo.error && !productos.length && <Falla texto={catalogo.error} />}

          <Aparecer orden={2}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.filaRubros}>
              {cargandoPrimeraVez
                ? [0, 1, 2, 3].map((i) => <Esqueleto key={i} alto={96} ancho={anchoRubro} radio={20} />)
                : losRubros.map((r) => (
                    <Tocable key={r} onPress={() => navigation.navigate('Buscar', { rubro: r })} style={[e.rubro, { width: anchoRubro }]} accessibilityRole="button" accessibilityLabel={r}>
                      <Image source={imagenDeRubro(r)} style={e.imagenRubro} contentFit="contain" transition={250} />
                      <Texto style={e.textoRubro} lineas={1}>
                        {rubroCorto(r)}
                      </Texto>
                    </Tocable>
                  ))}
            </ScrollView>
          </Aparecer>

          <Aparecer orden={3} style={e.cabeza}>
            <View style={e.etiquetaPrecio}>
              <Icono nombre="pricetag" tamano={20} color={COLOR.bosque} />
            </View>
            <View style={{ flex: 1 }}>
              <Texto style={e.titulo}>Precios de mayorista</Texto>
              <Texto v="gris">Más llevas, menos pagas.</Texto>
            </View>
            <Tocable onPress={() => navigation.navigate('Buscar')} style={e.verTodos} accessibilityRole="link">
              <Texto style={e.textoVerTodos}>Ver todos</Texto>
              <Icono nombre="arrow-forward" tamano={14} color={COLOR.bosque} />
            </Tocable>
          </Aparecer>

          <View style={e.grilla}>
            {cargandoPrimeraVez
              ? [0, 1, 2, 3, 4, 5].map((i) => <Esqueleto key={i} alto={236} ancho={anchoTarjeta} radio={20} />)
              : productos.map((p, i) => (
                  <Aparecer key={p.id} orden={4 + Math.min(i, 8)}>
                    <TarjetaDePrecio producto={p} ancho={anchoTarjeta} alAbrir={() => navigation.navigate('Producto', { id: p.id })} alAgregar={agregarRapido} />
                  </Aparecer>
                ))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Franja bosque detrás de la barra de estado: al bajar, la hora sigue viéndose en blanco */}
      <Animated.View pointerEvents="none" style={[e.franja, { height: arriba, opacity: bajada.interpolate({ inputRange: [30, 80], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />

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

/** El descuento de la presentación más grande frente a la más chica («-5 %»), o null si no hay. */
function descuento(p: Producto): string | null {
  const mejor = [...opcionesDeCompra(p)].reverse().find((o) => o.ahorra);
  const n = mejor?.ahorro.match(/\d+/)?.[0];
  return n ? `-${n} %` : null;
}

/** Tarjeta de la grilla: la foto con el «+» encima, el nombre, el contenido y el precio por unidad en grande. */
function TarjetaDePrecio({ producto: p, ancho, alAbrir, alAgregar }: { producto: Producto; ancho: number; alAbrir: () => void; alAgregar: (p: Producto) => void }) {
  const desde = precioDesde(p)!;
  const rebaja = descuento(p);
  const { nombre, contenido } = separarContenido(p.nombre);
  const foto: Origen = useRef(null);
  const volar = useVuelo();
  return (
    <Tocable hundir={0.97} conVibracion={false} onPress={alAbrir} style={[e.tarjeta, { width: ancho }]} accessibilityRole="button" accessibilityLabel={`${p.nombre}, ${desde.precioUnitario!.texto} cada uno llevando ${desde.cantidad}`}>
      <View ref={foto} style={[e.foto, { height: ancho - 12, backgroundColor: p.foto ? COLOR.superficie : TINTES[tinte(p.rubro)] }]}>
        <Image source={fotoDe(p)} style={e.imagen} contentFit="contain" transition={250} />
        {rebaja && (
          <View style={e.rebaja}>
            <Texto style={e.textoRebaja}>{rebaja}</Texto>
          </View>
        )}
        <Tocable
          onPress={() => {
            volar(foto, fotoDe(p));
            alAgregar(p);
          }}
          exterior={e.lugarMas}
          style={e.mas}
          accessibilityRole="button"
          accessibilityLabel={`Agregar ${p.nombre} al carrito`}
        >
          <Icono nombre="add" tamano={20} color={COLOR.lima} />
        </Tocable>
      </View>
      <View style={{ paddingHorizontal: 4, gap: 1 }}>
        <Texto lineas={2} style={e.nombre}>
          {nombre}
        </Texto>
        <Texto v="chico" lineas={1}>
          {contenido ?? rubroCorto(p.rubro)}
        </Texto>
      </View>
      <View style={e.precio}>
        <Texto style={e.textoPrecio} lineas={1}>
          {desde.precioUnitario!.texto}
        </Texto>
        <Texto style={e.porCuantos} lineas={1}>
          c/u llevando {desde.cantidad}
        </Texto>
      </View>
    </Tocable>
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
  cuerpo: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 16, gap: 18 },
  filaRubros: { gap: 10, paddingRight: 16, paddingBottom: 6 },
  rubro: { height: 96, borderRadius: 20, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center', gap: 2, ...SOMBRA },
  imagenRubro: { width: 58, height: 58 },
  textoRubro: { fontFamily: FUENTE.fuerte, fontSize: 12, color: COLOR.texto },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  etiquetaPrecio: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] },
  titulo: { fontFamily: FUENTE.negra, fontSize: 20, color: COLOR.texto, letterSpacing: -0.5 },
  verTodos: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: COLOR.limaMedia },
  textoVerTodos: { fontFamily: FUENTE.fuerte, fontSize: 12.5, color: COLOR.bosque },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: SEPARACION, marginTop: -6 },
  tarjeta: { padding: 6, paddingBottom: 8, gap: 6, borderRadius: 20, backgroundColor: COLOR.superficie, ...SOMBRA },
  foto: { borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imagen: { width: '88%', height: '88%' },
  rebaja: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 7, height: 22, borderRadius: 11, backgroundColor: COLOR.ambar, alignItems: 'center', justifyContent: 'center' },
  textoRebaja: { fontFamily: FUENTE.negra, fontSize: 11, color: COLOR.bosque },
  lugarMas: { position: 'absolute', right: 5, bottom: 5 },
  mas: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLOR.bosque, alignItems: 'center', justifyContent: 'center', ...SOMBRA, shadowOpacity: 0.2 },
  nombre: { fontFamily: FUENTE.fuerte, fontSize: 13, lineHeight: 16, color: COLOR.texto, minHeight: 32 },
  precio: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: COLOR.limaMedia },
  textoPrecio: { fontFamily: FUENTE.negra, fontSize: 17, color: COLOR.bosque, letterSpacing: -0.5 },
  porCuantos: { fontFamily: FUENTE.semi, fontSize: 10.5, color: COLOR.bosqueMedio, marginTop: -2 },
  sinSenal: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 18, backgroundColor: COLOR.ambarSuave },
});
