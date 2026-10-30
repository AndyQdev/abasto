import { bs, comprables, nombreCorto, ordenarMayoristas, precioDesde, rubros, type Producto } from '@abasto/comercio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Esqueleto, Tocable } from '../animacion';
import { BotonMas, Falla, Foto, Icono, Iniciales, Insignia, Seccion, SinPrecio, Texto } from '../componentes';
import { resumen } from '../direcciones';
import { useDirecciones } from '../direcciones-estado';
import { useEstado } from '../estado';
import { HojaDeDirecciones } from '../HojaDeDirecciones';
import { ILUSTRACION, imagenDeRubro, rubroCorto } from '../ilustraciones';
import type { PantallaDePestana } from '../navegacion';
import { useSesion } from '../sesion';
import { COLOR, SOMBRA } from '../tema';

interface Banner {
  titulo: string;
  detalle: string;
  imagen: number;
  rubro: string | null;
}

const BANNERS: Banner[] = [
  { titulo: 'Pide hoy,\nte lo llevamos', detalle: 'A tu tienda o a tu casa', imagen: ILUSTRACION.bannerEntrega, rubro: null },
  { titulo: 'Abarrotes al\npor mayor', detalle: 'Arroz, aceite, azúcar y más', imagen: ILUSTRACION.bannerAbarrotes, rubro: 'Abarrotes' },
  { titulo: 'Bebidas\npor caja', detalle: 'Gaseosas, agua y jugos', imagen: ILUSTRACION.bannerBebidas, rubro: 'Bebidas' },
  { titulo: 'Limpieza\npara el hogar', detalle: 'Detergentes, jabones y más', imagen: ILUSTRACION.bannerLimpieza, rubro: 'Limpieza del hogar' },
];

/** Inicio, como PedidosYa: dirección arriba, buscador, banners que pasan solos, rubros con su ilustración y productos. */
export function Inicio({ navigation }: PantallaDePestana<'Inicio'>) {
  const { usuario } = useSesion();
  const { catalogo, carrito, enLinea, agregarRapido } = useEstado();
  const { elegida, porConfirmar } = useDirecciones();
  const [hoja, setHoja] = useState(false);
  const arriba = useSafeAreaInsets().top;
  const enFoco = useIsFocused();

  // Al abrir la app se confirma la dirección una vez (como PedidosYa)
  useEffect(() => {
    if (porConfirmar) {
      const t = setTimeout(() => setHoja(true), 450);
      return () => clearTimeout(t);
    }
  }, [porConfirmar]);

  const productos = comprables(catalogo.productos);
  const destacados = [...productos].sort((a, b) => Number(b.precioVisible) - Number(a.precioVisible)).slice(0, 10);
  const ofertas = productos.filter((p) => p.precioVisible && p.escalas.some((e) => e.presentacion === 'CAJA' || e.presentacion === 'FARDO')).slice(0, 5);
  const vendedores = ordenarMayoristas(catalogo.mayoristas);
  const losRubros = rubros(catalogo.productos);
  const cuantos = (id: string) => productos.filter((p) => p.mayorista.id === id).length;
  const abrir = (p: Producto) => navigation.navigate('Producto', { id: p.id });
  const cargandoPrimeraVez = catalogo.cargando && !productos.length;

  return (
    <View style={e.pantalla}>
      {enFoco && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={catalogo.cargando && productos.length > 0} onRefresh={() => void catalogo.recargar()} tintColor="#fff" progressViewOffset={arriba} />}
      >
        <LinearGradient colors={[COLOR.tinta, COLOR.verde]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[e.cabecera, { paddingTop: arriba + 10 }]}>
          <View style={e.filaCabecera}>
            <Tocable onPress={() => setHoja(true)} exterior={{ flex: 1 }} style={e.direccion} accessibilityRole="button" accessibilityLabel={`Entregar en ${resumen(elegida)}. Cambiar dirección`}>
              <Texto v="chico" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {elegida ? `Entregar en · ${elegida.etiqueta}` : 'Entregar en'}
              </Texto>
              <View style={e.filaChica}>
                <Texto v="fuerte" lineas={1} style={e.textoDireccion}>
                  {resumen(elegida)}
                </Texto>
                <Icono nombre="chevron-down" color="#fff" tamano={18} />
              </View>
            </Tocable>
            <BotonCarrito cuantos={carrito.length} alTocar={() => navigation.navigate('Carrito')} />
          </View>

          {!!usuario?.nombre && (
            <Texto style={e.saludo} lineas={1}>
              Hola, {usuario.nombre.split(' ')[0]} 👋 ¿Qué necesitas hoy?
            </Texto>
          )}

          <View style={e.buscador}>
            <Tocable hundir={0.98} conVibracion={false} accessibilityRole="search" exterior={{ flex: 1 }} style={e.buscadorTexto} onPress={() => navigation.navigate('Buscar')}>
              <Icono nombre="search" color={COLOR.texto3} />
              <Texto v="gris" style={{ fontSize: 15 }}>
                Arroz, aceite, gaseosas…
              </Texto>
            </Tocable>
            <Tocable accessibilityRole="button" accessibilityLabel="Buscar con una foto" onPress={() => navigation.navigate('BuscarPorFoto')} style={e.camara}>
              <Icono nombre="camera" color="#fff" tamano={20} />
            </Tocable>
          </View>
        </LinearGradient>

        {!enLinea && <AvisoSinSenal />}

        <View style={e.cuerpo}>
          <Aparecer>
            <Carrusel alTocar={(b) => navigation.navigate('Buscar', b.rubro ? { rubro: b.rubro } : undefined)} />
          </Aparecer>

          {catalogo.error && !productos.length && <Falla texto={catalogo.error} />}

          <Aparecer orden={1}>
            <Seccion titulo="¿Qué buscas hoy?">
              {cargandoPrimeraVez ? (
                <View style={e.filaRubros}>
                  <Esqueleto alto={150} ancho="48%" radio={22} />
                  <Esqueleto alto={150} ancho="48%" radio={22} />
                </View>
              ) : (
                <>
                  <View style={e.filaRubros}>
                    {losRubros.slice(0, 2).map((r) => (
                      <TarjetaDeRubro key={r} rubro={r} grande alTocar={() => navigation.navigate('Buscar', { rubro: r })} />
                    ))}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.fila}>
                    {losRubros.slice(2).map((r) => (
                      <TarjetaDeRubro key={r} rubro={r} alTocar={() => navigation.navigate('Buscar', { rubro: r })} />
                    ))}
                  </ScrollView>
                </>
              )}
            </Seccion>
          </Aparecer>

          <Aparecer orden={2}>
            <Seccion titulo="Lo más pedido" enlace="Ver todos" alTocarEnlace={() => navigation.navigate('Buscar')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.fila}>
                {cargandoPrimeraVez
                  ? [0, 1, 2].map((i) => <Esqueleto key={i} alto={250} ancho={164} radio={20} />)
                  : destacados.map((p) => {
                      const desde = precioDesde(p);
                      return (
                        <Tocable key={p.id} hundir={0.97} conVibracion={false} onPress={() => abrir(p)} style={e.destacado}>
                          <Foto producto={p} alto={118} ancho="100%" />
                          <Texto v="fuerte" lineas={2} style={{ minHeight: 40 }}>
                            {p.nombre}
                          </Texto>
                          <Texto v="gris" lineas={1}>
                            {nombreCorto(p.mayorista.nombre)}
                          </Texto>
                          <View style={e.pie}>
                            {desde ? (
                              <>
                                <View>
                                  <Texto v="chico">desde</Texto>
                                  <Texto v="precio">{desde.precioUnitario!.texto}</Texto>
                                  <Texto v="chico">c/u por {desde.presentacion.toLowerCase()}</Texto>
                                </View>
                                <BotonMas producto={p} alAgregar={agregarRapido} />
                              </>
                            ) : (
                              <SinPrecio />
                            )}
                          </View>
                        </Tocable>
                      );
                    })}
              </ScrollView>
            </Seccion>
          </Aparecer>

          {ofertas.length > 0 && (
            <Aparecer orden={3}>
              <Seccion titulo="Ofertas por caja">
                {ofertas.map((p) => {
                  const grande = p.escalas.find((x) => x.presentacion === 'CAJA' || x.presentacion === 'FARDO')!;
                  return (
                    <Tocable key={p.id} hundir={0.98} conVibracion={false} onPress={() => abrir(p)} style={e.oferta}>
                      <Foto producto={p} alto={64} ancho={64} />
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
            <Aparecer orden={4}>
              <Seccion titulo="Vendedores" enlace="Ver todos" alTocarEnlace={() => navigation.navigate('Buscar', { modo: 'vendedores' })}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.fila}>
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
      </ScrollView>

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

/** El carrito del encabezado: la insignia salta cuando se agrega algo. */
function BotonCarrito({ cuantos, alTocar }: { cuantos: number; alTocar: () => void }) {
  const salto = useRef(new Animated.Value(1)).current;
  const antes = useRef(cuantos);
  useEffect(() => {
    if (cuantos > antes.current) {
      Animated.sequence([
        Animated.spring(salto, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(salto, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
      ]).start();
    }
    antes.current = cuantos;
  }, [cuantos, salto]);
  return (
    <Tocable onPress={alTocar} style={e.botonCarrito} accessibilityRole="button" accessibilityLabel={`Carrito, ${cuantos} productos`}>
      <Icono nombre="cart" tamano={22} color="#fff" />
      {cuantos > 0 && (
        <Animated.View style={[e.insigniaNum, { transform: [{ scale: salto }] }]}>
          <Texto style={e.num}>{cuantos}</Texto>
        </Animated.View>
      )}
    </Tocable>
  );
}

/** Banners que pasan solos cada 4,5 s, con los puntitos abajo. */
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
    }, 4500);
    return () => clearInterval(t);
  }, [ancho]);
  return (
    <View style={{ gap: 10 }}>
      <FlatList
        ref={lista}
        data={BANNERS}
        horizontal
        pagingEnabled={false}
        snapToInterval={ancho + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.titulo}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onMomentumScrollEnd={(ev) => setActual(Math.round(ev.nativeEvent.contentOffset.x / (ancho + 12)))}
        renderItem={({ item }) => (
          <Tocable hundir={0.98} onPress={() => alTocar(item)} style={[e.banner, { width: ancho }]} accessibilityRole="button" accessibilityLabel={item.titulo.replace('\n', ' ')}>
            <Image source={item.imagen} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" transition={250} />
            <LinearGradient colors={['rgba(238,243,240,0.96)', 'rgba(238,243,240,0.7)', 'rgba(238,243,240,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.75, y: 0 }} style={StyleSheet.absoluteFill} />
            <View style={e.textoBanner}>
              <Texto v="t1" style={{ color: COLOR.tinta, fontSize: 22, lineHeight: 26 }}>
                {item.titulo}
              </Texto>
              <Texto style={{ color: COLOR.texto2, fontSize: 13 }}>{item.detalle}</Texto>
              <View style={e.botonBanner}>
                <Texto v="fuerte" style={{ color: '#fff', fontSize: 13 }}>
                  Ver productos
                </Texto>
                <Icono nombre="arrow-forward" tamano={14} color="#fff" />
              </View>
            </View>
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

function TarjetaDeRubro({ rubro, grande, alTocar }: { rubro: string; grande?: boolean; alTocar: () => void }) {
  return (
    <Tocable onPress={alTocar} exterior={grande ? { flex: 1 } : undefined} style={[e.rubro, grande ? e.rubroGrande : e.rubroChico]} accessibilityRole="button" accessibilityLabel={rubro}>
      <Image source={imagenDeRubro(rubro)} style={grande ? e.imagenRubroGrande : e.imagenRubroChica} contentFit="contain" transition={250} />
      <Texto v="fuerte" lineas={1} style={{ fontSize: grande ? 16 : 13, textAlign: 'center' }}>
        {rubroCorto(rubro)}
      </Texto>
    </Tocable>
  );
}

export function AvisoSinSenal() {
  return (
    <View style={e.sinSenal} accessibilityRole="alert">
      <Image source={ILUSTRACION.sinSenal} style={{ width: 44, height: 33, borderRadius: 8 }} contentFit="cover" />
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
  cabecera: { paddingHorizontal: 16, paddingBottom: 18, gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  direccion: { paddingVertical: 4 },
  textoDireccion: { color: '#fff', fontSize: 17, flexShrink: 1 },
  saludo: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '600' },
  filaChica: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  botonCarrito: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  insigniaNum: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLOR.ambar,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: COLOR.verde,
  },
  num: { fontSize: 10.5, fontWeight: '800', color: '#2B1A00' },
  buscador: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 26, backgroundColor: COLOR.superficie, paddingLeft: 16, paddingRight: 5, ...SOMBRA },
  buscadorTexto: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52 },
  camara: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLOR.verde, alignItems: 'center', justifyContent: 'center' },
  cuerpo: { padding: 16, gap: 22 },
  banner: { height: 168, borderRadius: 24, overflow: 'hidden', backgroundColor: COLOR.verdeSuave },
  textoBanner: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, gap: 6, maxWidth: '62%' },
  botonBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: COLOR.verde, paddingHorizontal: 12, height: 32, borderRadius: 16, marginTop: 4 },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLOR.borde },
  puntoActivo: { width: 22, backgroundColor: COLOR.verde },
  filaRubros: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  fila: { gap: 12, paddingRight: 16 },
  rubro: { backgroundColor: COLOR.superficie, borderRadius: 22, alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderWidth: 1, borderColor: COLOR.borde },
  rubroGrande: { height: 158, padding: 12 },
  rubroChico: { width: 104, height: 116, padding: 8 },
  imagenRubroGrande: { width: '86%', flex: 1 },
  imagenRubroChica: { width: 74, height: 74 },
  destacado: { width: 164, gap: 6, padding: 10, borderRadius: 20, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  pie: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, marginTop: 'auto' },
  vendedor: { width: 176, gap: 6, padding: 12, borderRadius: 20, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  oferta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 8, borderRadius: 18, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  sinSenal: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: COLOR.ambarSuave },
});
