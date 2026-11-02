import { useEspacioBarra } from '../BarraInferior';
import { MIS_COMPRAS, pedidoDeLaSemana, rubrosDelNegocio, seccionesDelNegocio, separarContenido, tinte, type ClaveDeVitrina, type Pedido, type Producto, type TarjetaDeVitrina, type Vitrina } from '@abasto/comercio';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Esqueleto, Tocable } from '../animacion';
import { graphql } from '../api';
import { Falla, Icono, Texto, type NombreDeIcono } from '../componentes';
import { useDirecciones } from '../direcciones-estado';
import { useEstado } from '../estado';
import { CabeceraInicio } from '../CabeceraInicio';
import { guardado } from '../guardado';
import { PedidoDeLaSemanaCarta, SinIrAlMercado, useNegocio } from '../NegocioInicio';
import { HojaDeDirecciones } from '../HojaDeDirecciones';
import { fotoDe, ILUSTRACION, imagenDeRubro, rubroCorto } from '../ilustraciones';
import type { PantallaDePestana } from '../navegacion';
import { CABECERA, COLOR, FUENTE, SOMBRA, TINTES } from '../tema';
import { useVuelo, type Origen } from '../vuelo';

const ANCHO_TARJETA = 148;

/** Cómo se ve cada vitrina: su ícono y el color de la etiqueta que va sobre la foto */
const ESTILO: Record<ClaveDeVitrina, { icono: NombreDeIcono; etiqueta: [string, string] }> = {
  super: { icono: 'pricetag', etiqueta: [COLOR.ambar, COLOR.bosque] },
  reventa: { icono: 'trending-up', etiqueta: [COLOR.bosque, COLOR.lima] },
  probar: { icono: 'bag-handle', etiqueta: [COLOR.bosque, COLOR.lima] },
  volumen: { icono: 'cube', etiqueta: [COLOR.ambar, COLOR.bosque] },
  deAqui: { icono: 'flag', etiqueta: ['#FFFFFF', COLOR.bosque] },
  repone: { icono: 'repeat', etiqueta: [COLOR.bosque, COLOR.lima] },
  salteneria: { icono: 'flame', etiqueta: [COLOR.bosque, COLOR.lima] },
  panaderia: { icono: 'pizza', etiqueta: [COLOR.bosque, COLOR.lima] },
  pension: { icono: 'restaurant', etiqueta: [COLOR.bosque, COLOR.lima] },
  descartables: { icono: 'bag-handle', etiqueta: [COLOR.bosque, COLOR.lima] },
  sugeridos: { icono: 'sparkles', etiqueta: [COLOR.bosque, COLOR.lima] },
  despensa: { icono: 'basket', etiqueta: [COLOR.bosque, COLOR.lima] },
  casa: { icono: 'home', etiqueta: [COLOR.bosque, COLOR.lima] },
};
/** La etiqueta de un precio de demostración va en ámbar, para que se vea antes de pedir */
const POR_CONFIRMAR: [string, string] = [COLOR.ambar, COLOR.bosque];

/**
 * 01/11: el Inicio depende del tipo de cliente (hogar, tienda o productor con su subtipo), que se elige al
 * registrarse (`pantallas/Negocio.tsx`) y se cambia en Cuenta: sus rubros, sus secciones («La despensa del mes»,
 * «Para tu salteñería»…), «También te puede servir», «Tu pedido de la semana» y «No vuelvas a ir al mercado».
 * La lógica está en `negocios.ts` de packages/comercio y las piezas en `src/NegocioInicio.tsx`.
 *
 * Inicio de ABASTO (31/10): lo primero que se ve son los productos y sus precios. Encabezado compacto, rubros y
 * las vitrinas en carrusel (como Alibaba): cada una agrupa por un motivo para comprar (más barato que en el súper,
 * gana revendiendo, pruébalo con poco, más llevas más ahorras, marcas de aquí). La lógica está en `vitrinas()`.
 */
export function Inicio({ navigation }: PantallaDePestana<'Inicio'>) {
  const { catalogo, enLinea, agregarRapido, agregarAlCarrito, avisar } = useEstado();
  // Sin negocio no se llega aquí (el registro lo pide); la tienda queda por si acaso
  const negocio = useNegocio().negocio ?? { tipo: 'tienda' as const };
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
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

  // Los pedidos guardados en el teléfono y, con señal, los del servidor: de ahí sale «Tu pedido de la semana»
  useEffect(() => {
    if (!enFoco) return;
    void guardado.leer<Pedido[]>('pedidos').then((p) => p && setPedidos(p));
    if (!enLinea) return;
    graphql<{ misCompras: Pedido[] }>(MIS_COMPRAS)
      .then((d) => {
        setPedidos(d.misCompras);
        void guardado.escribir('pedidos', d.misCompras);
      })
      .catch(() => {
        /* sin sesión o sin servidor: queda lo guardado */
      });
  }, [enFoco, enLinea]);

  const estantes = seccionesDelNegocio(negocio, catalogo.productos);
  const losRubros = rubrosDelNegocio(negocio, catalogo.productos);
  const semana = pedidoDeLaSemana(pedidos, catalogo.productos);
  const horas = Math.max(24, ...catalogo.productos.filter((p) => p.mayorista.deLaCasa).map((p) => p.entregaHoras ?? 24));
  const repetir = () => {
    if (!semana) return;
    semana.items.forEach(agregarAlCarrito);
    avisar(`Agregamos ${semana.items.length} ${semana.items.length === 1 ? 'producto' : 'productos'} de tu pedido ${semana.codigo}`);
    navigation.navigate('Carrito');
  };
  const cargandoPrimeraVez = catalogo.cargando && !catalogo.productos.length;
  const anchoRubro = (width - 32 - 10 * 3) / 4;
  const abrir = (p: Producto) => navigation.navigate('Producto', { id: p.id });

  return (
    <View style={e.pantalla}>
      {enFoco && <StatusBar style="light" />}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: bajada } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: espacio }}
        refreshControl={<RefreshControl refreshing={catalogo.cargando && estantes.length > 0} onRefresh={() => void catalogo.recargar()} tintColor={COLOR.lima} colors={[COLOR.bosque]} />}
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
          {catalogo.error && !estantes.length && <Falla texto={catalogo.error} />}

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

          {cargandoPrimeraVez && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Esqueleto key={i} alto={250} ancho={ANCHO_TARJETA} radio={20} />
              ))}
            </View>
          )}

          {semana && (
            <Aparecer orden={3}>
              <PedidoDeLaSemanaCarta pedido={semana} alRepetir={repetir} />
            </Aparecer>
          )}

          <Aparecer orden={3}>
            <SinIrAlMercado horas={horas} />
          </Aparecer>

          {estantes.map((v, i) => (
            <Aparecer key={v.clave} orden={3 + i}>
              <Estante vitrina={v} alAbrir={abrir} alAgregar={agregarRapido} alVerTodo={() => navigation.navigate('Buscar')} />
            </Aparecer>
          ))}
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

/** Una vitrina: título con su promesa, subtítulo con la prueba y el carrusel que sale hasta el borde. */
function Estante({ vitrina: v, alAbrir, alAgregar, alVerTodo }: { vitrina: Vitrina; alAbrir: (p: Producto) => void; alAgregar: (p: Producto) => void; alVerTodo: () => void }) {
  const { icono } = ESTILO[v.clave];
  return (
    <View style={{ gap: 10 }}>
      <View style={e.cabeza}>
        <View style={e.icono}>
          <Icono nombre={icono} tamano={19} color={COLOR.bosque} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto style={e.titulo} lineas={1}>
            {v.titulo}
          </Texto>
          <Texto v="gris" lineas={2}>
            {v.subtitulo}
          </Texto>
        </View>
        <Tocable onPress={alVerTodo} style={e.flecha} accessibilityRole="link" accessibilityLabel={`Ver todo: ${v.titulo}`}>
          <Icono nombre="arrow-forward" tamano={20} color={COLOR.bosque} />
        </Tocable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.carrusel} style={e.sinMargen} decelerationRate="fast" snapToInterval={ANCHO_TARJETA + 10}>
        {v.tarjetas.map((t) => (
          <TarjetaDeEstante key={t.producto.id} clave={v.clave} tarjeta={t} alAbrir={() => alAbrir(t.producto)} alAgregar={alAgregar} />
        ))}
      </ScrollView>
    </View>
  );
}

function TarjetaDeEstante({ clave, tarjeta: t, alAbrir, alAgregar }: { clave: ClaveDeVitrina; tarjeta: TarjetaDeVitrina; alAbrir: () => void; alAgregar: (p: Producto) => void }) {
  const p = t.producto;
  const { nombre, contenido } = separarContenido(p.nombre);
  const [fondo, letra] = p.precioPorConfirmar ? POR_CONFIRMAR : ESTILO[clave].etiqueta;
  const foto: Origen = useRef(null);
  const volar = useVuelo();
  return (
    <Tocable hundir={0.97} conVibracion={false} onPress={alAbrir} style={e.tarjeta} accessibilityRole="button" accessibilityLabel={`${p.nombre}. ${t.precio} ${t.detalle}. ${t.gancho}`}>
      <View ref={foto} style={[e.foto, { backgroundColor: p.foto ? COLOR.superficie : TINTES[tinte(p.rubro)] }]}>
        <Image source={fotoDe(p)} style={e.imagen} contentFit="contain" transition={250} />
        <View style={[e.etiqueta, { backgroundColor: fondo }, clave === 'deAqui' && e.etiquetaClara]}>
          <Texto style={[e.textoEtiqueta, { color: letra }]} lineas={1}>
            {clave === 'deAqui' ? `🇧🇴 ${t.gancho}` : t.gancho}
          </Texto>
        </View>
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
      <View style={[e.precio, clave === 'reventa' && e.precioGanancia]}>
        {t.tachado && (
          <Texto style={e.tachado} lineas={1}>
            {t.tachado}
          </Texto>
        )}
        <Texto style={[e.textoPrecio, clave === 'reventa' && { color: COLOR.lima }]} lineas={1}>
          {t.precio}
        </Texto>
        <Texto style={[e.detalle, clave === 'reventa' && { color: COLOR.limaMedia }]} lineas={1}>
          {t.detalle}
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
  cuerpo: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 16, gap: 22 },
  filaRubros: { gap: 10, paddingRight: 16, paddingBottom: 6 },
  rubro: { height: 96, borderRadius: 20, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center', gap: 2, ...SOMBRA },
  imagenRubro: { width: 58, height: 58 },
  textoRubro: { fontFamily: FUENTE.fuerte, fontSize: 12, color: COLOR.texto },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icono: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-10deg' }] },
  titulo: { fontFamily: FUENTE.negra, fontSize: 19, color: COLOR.texto, letterSpacing: -0.5 },
  flecha: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.limaMedia },
  // El carrusel llega hasta los bordes de la pantalla: se ve que sigue
  sinMargen: { marginHorizontal: -16 },
  carrusel: { gap: 10, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 2 },
  tarjeta: { width: ANCHO_TARJETA, padding: 6, paddingBottom: 8, gap: 6, borderRadius: 20, backgroundColor: COLOR.superficie, ...SOMBRA },
  foto: { height: ANCHO_TARJETA - 16, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imagen: { width: '86%', height: '86%' },
  etiqueta: { position: 'absolute', top: 6, left: 6, maxWidth: ANCHO_TARJETA - 24, paddingHorizontal: 8, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  etiquetaClara: { borderWidth: 1, borderColor: COLOR.borde },
  textoEtiqueta: { fontFamily: FUENTE.negra, fontSize: 11 },
  lugarMas: { position: 'absolute', right: 5, bottom: 5 },
  mas: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLOR.bosque, alignItems: 'center', justifyContent: 'center', ...SOMBRA, shadowOpacity: 0.2 },
  nombre: { fontFamily: FUENTE.fuerte, fontSize: 13, lineHeight: 16, color: COLOR.texto, minHeight: 32 },
  precio: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: COLOR.limaMedia },
  precioGanancia: { backgroundColor: COLOR.bosque },
  tachado: { fontFamily: FUENTE.semi, fontSize: 10.5, color: COLOR.texto3, textDecorationLine: 'line-through' },
  textoPrecio: { fontFamily: FUENTE.negra, fontSize: 18, color: COLOR.bosque, letterSpacing: -0.5 },
  detalle: { fontFamily: FUENTE.semi, fontSize: 10.5, color: COLOR.bosqueMedio, marginTop: -2 },
  sinSenal: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 18, backgroundColor: COLOR.ambarSuave },
});
