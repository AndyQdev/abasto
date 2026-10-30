import { bs, comprables, nombreCorto, ordenarMayoristas, precioDesde, rubros, tinte, type Producto } from '@abasto/comercio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Esqueleto, Flotar, Tocable } from '../animacion';
import { BotonMas, Falla, Icono, Iniciales, Insignia, Logo, Seccion, SinPrecio, Texto } from '../componentes';
import { resumen } from '../direcciones';
import { useDirecciones } from '../direcciones-estado';
import { useEstado } from '../estado';
import { HojaDeDirecciones } from '../HojaDeDirecciones';
import { ILUSTRACION, imagenDeRubro, rubroCorto } from '../ilustraciones';
import type { PantallaDePestana } from '../navegacion';
import { useSesion } from '../sesion';
import { COLOR, FUENTE, SOMBRA, TINTES } from '../tema';

interface Banner {
  titulo: string;
  detalle: string;
  imagen: number;
  rubro: string | null;
  fondo: [string, string];
}

const BANNERS: Banner[] = [
  { titulo: 'Abarrotes\nal por mayor', detalle: 'Mejores precios para tu negocio', imagen: ILUSTRACION.bannerAbarrotes, rubro: 'Abarrotes', fondo: ['#DDF7F0', '#9FEBDA'] },
  { titulo: 'Pide hoy,\nte lo llevamos', detalle: 'A tu tienda o a tu casa', imagen: ILUSTRACION.bannerEntrega, rubro: null, fondo: ['#E6F9F4', '#B5F0E2'] },
  { titulo: 'Bebidas\npor caja', detalle: 'Gaseosas, agua y jugos', imagen: ILUSTRACION.bannerBebidas, rubro: 'Bebidas', fondo: ['#E3F6FA', '#A9E6EE'] },
  { titulo: 'Limpieza\npara el hogar', detalle: 'Detergentes, jabones y más', imagen: ILUSTRACION.bannerLimpieza, rubro: 'Limpieza del hogar', fondo: ['#EEF9DA', '#CDEF8A'] },
];

/** Fondos suaves para los cuadros de los rubros */
const COLORES_RUBRO = ['#DDF7EF', '#E1F1FB', '#EDE7FB', '#E2F6E9', '#E6F4FA', '#FCEFE3', '#F3FAD9', '#FCEFF1'];

/** Inicio de ABASTO: dirección, buscador, banners con el 3D que sobresale, rubros y ofertas. */
export function Inicio({ navigation }: PantallaDePestana<'Inicio'>) {
  const { usuario } = useSesion();
  const { catalogo, enLinea, agregarRapido } = useEstado();
  const { elegida, porConfirmar } = useDirecciones();
  const [hoja, setHoja] = useState(false);
  const arriba = useSafeAreaInsets().top;

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
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={catalogo.cargando && productos.length > 0} onRefresh={() => void catalogo.recargar()} tintColor={COLOR.verde} colors={[COLOR.verde]} />}
      >
        <View style={[e.cabecera, { paddingTop: arriba + 8 }]}>
          <View style={e.filaCabecera}>
            <Logo tamano={30} />
            <Tocable
              onPress={() => setHoja(true)}
              exterior={{ flex: 1, alignItems: 'flex-end' }}
              style={e.direccion}
              accessibilityRole="button"
              accessibilityLabel={`Entregar en ${resumen(elegida)}. Cambiar dirección`}
            >
              <Icono nombre="location" tamano={18} color={COLOR.verde} />
              <View style={{ flexShrink: 1 }}>
                <Texto v="chico">Entregar en</Texto>
                <View style={e.filaChica}>
                  <Texto v="fuerte" lineas={1} style={{ flexShrink: 1, fontSize: 13.5 }}>
                    {resumen(elegida)}
                  </Texto>
                  <Icono nombre="chevron-down" tamano={14} color={COLOR.texto} />
                </View>
              </View>
            </Tocable>
            <Tocable onPress={() => navigation.navigate('Pedidos')} style={e.campana} accessibilityRole="button" accessibilityLabel="Mis pedidos y avisos">
              <Icono nombre="notifications-outline" tamano={22} color={COLOR.texto} />
            </Tocable>
          </View>

          <View style={e.buscador}>
            <Tocable hundir={0.98} conVibracion={false} accessibilityRole="search" exterior={{ flex: 1 }} style={e.buscadorTexto} onPress={() => navigation.navigate('Buscar')}>
              <Icono nombre="search" color={COLOR.texto2} />
              <Texto v="gris" style={{ fontSize: 14.5 }}>
                Buscar productos, categorías…
              </Texto>
            </Tocable>
            <Tocable accessibilityRole="button" accessibilityLabel="Buscar con una foto" onPress={() => navigation.navigate('BuscarPorFoto')} style={e.camara}>
              <Icono nombre="scan" color={COLOR.verde} tamano={20} />
            </Tocable>
          </View>
        </View>

        {!enLinea && <AvisoSinSenal />}

        <View style={e.cuerpo}>
          {!!usuario?.nombre && (
            <Aparecer>
              <Texto v="t2">Hola, {usuario.nombre.split(' ')[0]} 👋</Texto>
              <Texto v="gris">Todo lo que necesitas por mayor, en un solo lugar.</Texto>
            </Aparecer>
          )}

          <Aparecer orden={1}>
            <Carrusel alTocar={(b) => navigation.navigate('Buscar', b.rubro ? { rubro: b.rubro } : undefined)} />
          </Aparecer>

          {catalogo.error && !productos.length && <Falla texto={catalogo.error} />}

          <Aparecer orden={2}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.filaRubros}>
              {cargandoPrimeraVez
                ? [0, 1, 2, 3, 4].map((i) => <Esqueleto key={i} alto={92} ancho={70} radio={20} />)
                : losRubros.map((r, i) => (
                    <Tocable key={r} onPress={() => navigation.navigate('Buscar', { rubro: r })} style={e.rubro} accessibilityRole="button" accessibilityLabel={r}>
                      <View style={[e.cuadroRubro, { backgroundColor: COLORES_RUBRO[i % COLORES_RUBRO.length] }]}>
                        <Image source={imagenDeRubro(r)} style={e.imagenRubro} contentFit="contain" transition={250} />
                      </View>
                      <Texto style={e.textoRubro} lineas={1}>
                        {rubroCorto(r)}
                      </Texto>
                    </Tocable>
                  ))}
            </ScrollView>
          </Aparecer>

          <Aparecer orden={3}>
            <Seccion titulo="Ofertas de la semana" enlace="Ver todas →" alTocarEnlace={() => navigation.navigate('Buscar')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.filaOfertas}>
                {cargandoPrimeraVez
                  ? [0, 1, 2].map((i) => <Esqueleto key={i} alto={250} ancho={168} radio={22} />)
                  : ofertas.map((p, i) => <TarjetaDeOferta key={p.id} producto={p} orden={i} alAbrir={() => abrir(p)} alAgregar={agregarRapido} />)}
              </ScrollView>
            </Seccion>
          </Aparecer>

          {porCaja.length > 0 && (
            <Aparecer orden={4}>
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
            <Aparecer orden={5}>
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

function TarjetaDeOferta({ producto: p, orden, alAbrir, alAgregar }: { producto: Producto; orden: number; alAbrir: () => void; alAgregar: (p: Producto) => void }) {
  const desde = precioDesde(p);
  return (
    <Tocable hundir={0.97} conVibracion={false} onPress={alAbrir} style={e.oferta}>
      <View style={[e.fotoOferta, { backgroundColor: TINTES[tinte(p.rubro)] }]}>
        <Flotar alto={4} duracion={3000} retraso={orden * 220}>
          <Image source={imagenDeRubro(p.rubro)} style={e.imagenOferta} contentFit="contain" transition={250} />
        </Flotar>
        {desde && (
          <View style={e.porcentaje}>
            <Texto style={e.textoPorcentaje}>%</Texto>
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
            <BotonMas producto={p} alAgregar={alAgregar} />
          </>
        ) : (
          <SinPrecio />
        )}
      </View>
    </Tocable>
  );
}

/** Banners con degradado menta: el 3D flota y sale por arriba; pasan solos cada 4,5 s. */
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
        snapToInterval={ancho + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.titulo}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingTop: 26 }}
        style={{ marginTop: -26 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onMomentumScrollEnd={(ev) => setActual(Math.round(ev.nativeEvent.contentOffset.x / (ancho + 12)))}
        renderItem={({ item }) => (
          <Tocable hundir={0.98} onPress={() => alTocar(item)} style={{ width: ancho, height: 170 }} accessibilityRole="button" accessibilityLabel={item.titulo.replace('\n', ' ')}>
            <LinearGradient colors={item.fondo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={e.banner}>
              <View style={e.textoBanner}>
                <Texto style={e.tituloBanner}>{item.titulo}</Texto>
                <Texto v="gris" style={{ color: COLOR.texto2 }}>
                  {item.detalle}
                </Texto>
                <View style={e.botonBanner}>
                  <Texto style={{ color: COLOR.verde, fontFamily: FUENTE.fuerte, fontSize: 13 }}>Ver productos</Texto>
                  <Icono nombre="arrow-forward" tamano={14} color={COLOR.verde} />
                </View>
              </View>
            </LinearGradient>
            {/* El 3D va afuera del degradado para poder salirse por arriba */}
            <Flotar alto={7} style={e.objetoBanner}>
              <Image source={item.imagen} style={{ width: '100%', height: '100%' }} contentFit="contain" transition={250} />
            </Flotar>
            <View style={e.insigniaBanner}>
              <Texto style={[e.textoPorcentaje, { color: COLOR.lima }]}>%</Texto>
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
  cabecera: { backgroundColor: COLOR.superficie, paddingHorizontal: 16, paddingBottom: 14, gap: 12, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, ...SOMBRA },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  direccion: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 170 },
  filaChica: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  campana: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLOR.mentaClara, alignItems: 'center', justifyContent: 'center' },
  buscador: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 18, backgroundColor: COLOR.superficie, borderWidth: 2, borderColor: COLOR.menta, paddingLeft: 14, paddingRight: 6 },
  buscadorTexto: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50 },
  camara: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLOR.mentaClara, alignItems: 'center', justifyContent: 'center' },
  cuerpo: { padding: 16, gap: 22 },
  banner: { flex: 1, borderRadius: 26, overflow: 'hidden' },
  textoBanner: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, gap: 4, maxWidth: '58%' },
  tituloBanner: { fontFamily: FUENTE.negra, fontSize: 22, lineHeight: 26, color: COLOR.texto, letterSpacing: -0.4 },
  botonBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: COLOR.lima, paddingHorizontal: 14, height: 34, borderRadius: 17, marginTop: 8 },
  objetoBanner: { position: 'absolute', right: -4, top: -24, width: '50%', height: 196 },
  insigniaBanner: { position: 'absolute', right: 14, top: -6, width: 38, height: 38, borderRadius: 19, backgroundColor: COLOR.verde, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  textoPorcentaje: { fontFamily: FUENTE.negra, fontSize: 16, color: COLOR.verde },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLOR.mentaMedia },
  puntoActivo: { width: 24, backgroundColor: COLOR.verde },
  filaRubros: { gap: 12, paddingRight: 16 },
  rubro: { width: 72, alignItems: 'center', gap: 6 },
  cuadroRubro: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  imagenRubro: { width: 56, height: 56 },
  textoRubro: { fontFamily: FUENTE.semi, fontSize: 12, color: COLOR.texto2 },
  filaOfertas: { gap: 12, paddingRight: 16, paddingTop: 4, paddingBottom: 8 },
  oferta: { width: 168, gap: 4, padding: 10, borderRadius: 22, backgroundColor: COLOR.superficie, ...SOMBRA },
  fotoOferta: { height: 120, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  imagenOferta: { width: 104, height: 104 },
  porcentaje: { position: 'absolute', top: 8, left: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  pie: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, marginTop: 'auto' },
  porCaja: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 10, borderRadius: 20, backgroundColor: COLOR.superficie, ...SOMBRA },
  miniatura: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  vendedor: { width: 176, gap: 6, padding: 12, borderRadius: 22, backgroundColor: COLOR.superficie, ...SOMBRA },
  sinSenal: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 18, backgroundColor: COLOR.ambarSuave },
});
