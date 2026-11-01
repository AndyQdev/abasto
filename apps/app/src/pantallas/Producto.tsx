import { bs, cantidadDe, disponible, escalaPorDefecto, escalasConPrecio, frenteAlSuper, itemDeCarrito, nombreDe, opcionesDeCompra, textoDeStock } from '@abasto/comercio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Flotar, Tocable, useLatido } from '../animacion';
import { Boton, colorDeClase, Icono, Insignia, PedirSerCliente, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import { fotoDe, imagenDePresentacion } from '../ilustraciones';
import type { PantallaDePila } from '../navegacion';
import { COLOR, FUENTE, SOMBRA } from '../tema';
import { useVuelo, type Origen } from '../vuelo';

/** Ficha del producto: el 3D grande sobre lima pálido, el precio claro y las presentaciones fáciles de comparar. */
export function Producto({ navigation, route }: PantallaDePila<'Producto'>) {
  const { catalogo, enLinea, agregarAlCarrito, pedirSerCliente } = useEstado();
  const p = catalogo.productos.find((x) => x.id === route.params.id);
  const [presentacion, setPresentacion] = useState(p ? (escalaPorDefecto(p)?.presentacion ?? null) : null);
  const [cantidad, setCantidad] = useState(1);
  const [latido, latir] = useLatido();
  const arriba = useSafeAreaInsets().top;
  const foto: Origen = useRef(null);
  const volar = useVuelo();

  if (!p) {
    return (
      <SafeAreaView style={e.pantalla}>
        <View style={{ padding: 16 }}>
          <Vacio titulo="No encontramos este producto" detalle="Puede que ya no esté a la venta.">
            <Boton tipo="chico" texto="Volver" alTocar={() => navigation.goBack()} />
          </Vacio>
        </View>
      </SafeAreaView>
    );
  }

  const opciones = opcionesDeCompra(p);
  const elegida = opciones.find((o) => o.presentacion === presentacion);
  const escala = escalasConPrecio(p).find((x) => x.presentacion === presentacion);
  const stock = textoDeStock(p);
  const sePuede = disponible(p);
  // La de mejor precio por unidad: la última que ahorra (las presentaciones vienen de menor a mayor)
  const mejor = [...opciones].reverse().find((o) => o.ahorra)?.presentacion;
  const rebaja = elegida?.ahorra ? elegida.ahorro.match(/\d+/)?.[0] : null;
  const alSuper = escala ? frenteAlSuper(p, escala) : null;

  return (
    <View style={e.pantalla}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} bounces={false}>
        <LinearGradient colors={['#E4F6AE', COLOR.fondo]} style={[e.vitrina, { paddingTop: arriba + 8 }]}>
          <View style={e.barraArriba}>
            <Tocable onPress={() => navigation.goBack()} style={e.botonRedondo} accessibilityRole="button" accessibilityLabel="Volver">
              <Icono nombre="arrow-back" color={COLOR.bosque} />
            </Tocable>
            <Insignia texto={stock.texto} color={colorDeClase(stock.clase)} />
          </View>
          <Aparecer desde={20}>
            <Flotar alto={10} duracion={3200}>
              <View ref={foto}>
                <Image source={fotoDe(p)} style={[e.imagen, !!p.foto && e.conFoto]} contentFit="contain" transition={300} />
              </View>
            </Flotar>
          </Aparecer>
        </LinearGradient>

        <Aparecer orden={1} desde={40}>
          <View style={e.cuerpo}>
            <View style={{ gap: 4 }}>
              <Texto v="t1">{p.nombre}</Texto>
              <Texto v="gris">{p.rubro}</Texto>
            </View>

            {elegida && (
              <View style={e.filaPrecio}>
                <Animated.View style={{ transform: [{ scale: latido }] }}>
                  <Texto style={e.precioGrande}>
                    {elegida.precioUnitario} <Texto style={e.cu}>c/u</Texto>
                  </Texto>
                  <Texto v="fuerte" style={{ color: COLOR.texto2 }}>
                    {elegida.nombre} de {elegida.unidades} u.
                  </Texto>
                </Animated.View>
                {rebaja && (
                  <View style={e.rebaja}>
                    <Texto style={e.textoRebaja}>-{rebaja} %</Texto>
                  </View>
                )}
              </View>
            )}

            {/* Nicho de cocina (01/11): el precio es de demostración hasta que Abasto lo cotice en el mercado */}
            {p.precioPorConfirmar && (
              <View style={[e.super, { backgroundColor: COLOR.ambarSuave, borderColor: COLOR.ambar }]}>
                <View style={e.filaSuper}>
                  <Icono nombre="information-circle" tamano={18} color={COLOR.ambarTexto} />
                  <Texto style={{ flex: 1, color: COLOR.ambarTexto }}>
                    <Texto style={[e.fuerteSuper, { color: COLOR.ambarTexto }]}>Precio por confirmar.</Texto> Es de referencia: lo estamos cotizando en el mercado esta
                    semana.
                  </Texto>
                </View>
              </View>
            )}

            {/* El ancla: lo que cuesta en el súper y lo que le queda a la tienda si lo revende a ese precio */}
            {alSuper && alSuper.gananciaPorUnidad > 0 && escala && (
              <View style={e.super}>
                <View style={e.filaSuper}>
                  <Icono nombre="storefront-outline" tamano={18} color={COLOR.bosque} />
                  <Texto style={{ flex: 1, color: COLOR.texto2 }}>
                    En el súper <Texto style={e.tachadoSuper}>{alSuper.precioSuper}</Texto> · aquí ahorras{' '}
                    <Texto style={e.fuerteSuper}>{alSuper.porcentaje} %</Texto>
                  </Texto>
                </View>
                <View style={e.filaSuper}>
                  <Icono nombre="trending-up" tamano={18} color={COLOR.bosque} />
                  <Texto style={{ flex: 1, color: COLOR.texto2 }}>
                    Si lo revendes a ese precio ganas <Texto style={e.fuerteSuper}>{bs(alSuper.gananciaPorUnidad)} c/u</Texto>
                    {escala.cantidad > 1 && ` · ${bs(alSuper.gananciaPorUnidad * escala.cantidad)} por ${nombreDe(escala.presentacion)}`}
                  </Texto>
                </View>
                <Texto v="chico">
                  Precio de {alSuper.donde} del {alSuper.fecha}
                </Texto>
              </View>
            )}

            {opciones.length ? (
              <View style={{ gap: 10 }}>
                <Texto v="t3">Elige cómo lo compras</Texto>
                <View style={e.opciones} accessibilityRole="radiogroup" accessibilityLabel="Presentación">
                  {opciones.map((o) => {
                    const activa = o.presentacion === presentacion;
                    return (
                      <Tocable
                        key={o.presentacion}
                        exterior={{ flex: 1 }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: activa }}
                        onPress={() => {
                          setPresentacion(o.presentacion);
                          latir();
                        }}
                        style={[e.opcion, activa && e.opcionActiva]}
                      >
                        {o.presentacion === mejor && (
                          <View style={e.cinta}>
                            <Texto style={e.textoCinta}>Mejor precio</Texto>
                          </View>
                        )}
                        <Image source={imagenDePresentacion(o.presentacion, p.rubro)} style={e.iconoPresentacion} contentFit="contain" />
                        <Texto v="fuerte" style={{ fontSize: 13.5 }}>
                          {o.nombre}
                        </Texto>
                        <Texto v="chico">{o.unidades} u.</Texto>
                        <Texto v="precio" style={{ fontSize: 15 }}>
                          {o.precioUnitario}
                        </Texto>
                        <Texto v="chico">c/u</Texto>
                      </Tocable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <PedirSerCliente
                mayorista={p.mayorista}
                enLinea={enLinea}
                alPedir={pedirSerCliente}
                titulo="Pide ser cliente para ver precios"
                detalle={`${p.mayorista.nombre} muestra sus precios a las tiendas que aprueba.`}
              />
            )}

            <Tocable onPress={() => navigation.navigate('Vendedor', { id: p.mayorista.id })} style={e.vendedor} accessibilityRole="button">
              <View style={e.iconoVendedor}>
                <Icono nombre="storefront" tamano={18} color={COLOR.bosque} />
              </View>
              <View style={{ flex: 1 }}>
                <Texto v="chico">Lo vende</Texto>
                <Texto v="fuerte">{p.mayorista.nombre}</Texto>
              </View>
              <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
            </Tocable>

            {p.abastecimiento === 'BAJO_PEDIDO' && (
              <View style={e.entrega}>
                <Icono nombre="time" color={COLOR.bosque} />
                <Texto style={{ flex: 1, color: COLOR.texto2 }}>Lo compramos cuando haces el pedido. Llega en {p.entregaHoras ?? 24} horas.</Texto>
              </View>
            )}

            {!!p.descripcion && (
              <View style={{ gap: 6 }}>
                <Texto v="t3">Descripción</Texto>
                <Texto style={{ color: COLOR.texto2 }}>{p.descripcion}</Texto>
              </View>
            )}
          </View>
        </Aparecer>
      </ScrollView>

      {elegida && escala && (
        <SafeAreaView edges={['bottom']} style={e.barra}>
          <View style={e.filaBarra}>
            <View style={e.contador} accessibilityLabel="Cantidad">
              <Tocable accessibilityRole="button" accessibilityLabel="Quitar uno" disabled={cantidad <= 1} onPress={() => setCantidad((c) => c - 1)} style={e.paso}>
                <Icono nombre="remove" color={cantidad <= 1 ? COLOR.texto3 : COLOR.bosque} />
              </Tocable>
              <Texto v="t2" style={{ minWidth: 28, textAlign: 'center' }}>
                {cantidad}
              </Texto>
              <Tocable accessibilityRole="button" accessibilityLabel="Agregar uno" onPress={() => setCantidad((c) => c + 1)} style={[e.paso, e.pasoMas]}>
                <Icono nombre="add" color={COLOR.bosque} />
              </Tocable>
            </View>
            <View style={{ flex: 1 }}>
              <Boton
                tipo="oscuro"
                texto={sePuede ? `Agregar ${cantidadDe(elegida.presentacion, cantidad)}` : 'Sin stock por ahora'}
                icono="cart"
                deshabilitado={!sePuede}
                alTocar={() => {
                  volar(foto, fotoDe(p));
                  agregarAlCarrito(itemDeCarrito(p, escala, cantidad));
                  setCantidad(1);
                }}
              />
            </View>
          </View>
          <Texto v="chico" style={{ textAlign: 'center' }}>
            {elegida.unidades * cantidad} u. en total · {bs(elegida.totalCentavos * cantidad)}
          </Texto>
        </SafeAreaView>
      )}
    </View>
  );
}

const e = StyleSheet.create({
  super: { gap: 8, padding: 14, borderRadius: 20, backgroundColor: COLOR.limaSuave, borderWidth: 1, borderColor: COLOR.limaMedia },
  filaSuper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tachadoSuper: { textDecorationLine: 'line-through', color: COLOR.texto3 },
  fuerteSuper: { fontFamily: FUENTE.negra, color: COLOR.bosque },
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  vitrina: { paddingHorizontal: 16, paddingBottom: 46, alignItems: 'center' },
  barraArriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  botonRedondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center', ...SOMBRA },
  imagen: { width: 260, height: 260 },
  // La foto real lleva su fondo blanco: va en una tarjeta redonda para que no quede un cuadrado suelto
  conFoto: { borderRadius: 32, backgroundColor: '#FFFFFF' },
  cuerpo: { marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: COLOR.superficie, padding: 20, gap: 18 },
  filaPrecio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  precioGrande: { fontFamily: FUENTE.negra, fontSize: 36, color: COLOR.bosque, letterSpacing: -1 },
  cu: { fontFamily: FUENTE.fuerte, fontSize: 18, color: COLOR.texto2 },
  rebaja: { paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: COLOR.ambar, alignItems: 'center', justifyContent: 'center' },
  textoRebaja: { fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.bosque },
  opciones: { flexDirection: 'row', gap: 8, paddingTop: 12 },
  opcion: { alignItems: 'center', gap: 1, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 4, borderRadius: 20, borderWidth: 2, borderColor: COLOR.borde, backgroundColor: COLOR.superficie },
  opcionActiva: { borderColor: COLOR.bosque, backgroundColor: COLOR.lima },
  iconoPresentacion: { width: 46, height: 46, marginBottom: 4 },
  cinta: { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: COLOR.bosque, paddingHorizontal: 9, height: 24, borderRadius: 12, justifyContent: 'center', zIndex: 1 },
  textoCinta: { fontFamily: FUENTE.fuerte, fontSize: 10, color: COLOR.lima },
  vendedor: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: COLOR.fondo },
  iconoVendedor: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  entrega: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 20, backgroundColor: COLOR.limaSuave },
  barra: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 6, backgroundColor: COLOR.superficie, borderTopLeftRadius: 26, borderTopRightRadius: 26, ...SOMBRA, shadowOffset: { width: 0, height: -6 } },
  filaBarra: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 18, backgroundColor: COLOR.fondo },
  paso: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pasoMas: { backgroundColor: COLOR.lima },
});
