import { bs, cantidadDe, disponible, escalaPorDefecto, escalasConPrecio, itemDeCarrito, opcionesDeCompra, textoDeStock } from '@abasto/comercio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Flotar, Tocable, useLatido, vibrar } from '../animacion';
import { Boton, colorDeClase, Icono, Insignia, PedirSerCliente, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import { imagenDeRubro } from '../ilustraciones';
import type { PantallaDePila } from '../navegacion';
import { COLOR, FUENTE, SOMBRA } from '../tema';

/** Ficha del producto: el 3D grande arriba, el precio claro y las presentaciones (unidad, docena, caja, fardo). */
export function Producto({ navigation, route }: PantallaDePila<'Producto'>) {
  const { catalogo, enLinea, agregarAlCarrito, pedirSerCliente } = useEstado();
  const p = catalogo.productos.find((x) => x.id === route.params.id);
  const [presentacion, setPresentacion] = useState(p ? (escalaPorDefecto(p)?.presentacion ?? null) : null);
  const [cantidad, setCantidad] = useState(1);
  const [latido, latir] = useLatido();
  const arriba = useSafeAreaInsets().top;

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

  return (
    <View style={e.pantalla}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} bounces={false}>
        <LinearGradient colors={[COLOR.mentaMedia, COLOR.mentaClara]} style={[e.vitrina, { paddingTop: arriba + 8 }]}>
          <View style={e.barraArriba}>
            <Tocable onPress={() => navigation.goBack()} style={e.botonRedondo} accessibilityRole="button" accessibilityLabel="Volver">
              <Icono nombre="chevron-back" color={COLOR.verde} />
            </Tocable>
            <Insignia texto={stock.texto} color={colorDeClase(stock.clase)} />
          </View>
          <Aparecer desde={20}>
            <Flotar alto={10} duracion={3200}>
              <Image source={imagenDeRubro(p.rubro)} style={e.imagen} contentFit="contain" transition={300} />
            </Flotar>
          </Aparecer>
        </LinearGradient>

        <Aparecer orden={1} desde={40}>
          <View style={e.cuerpo}>
            <View style={{ gap: 4 }}>
              <Texto v="t1">{p.nombre}</Texto>
              {elegida && (
                <Texto v="gris">
                  {elegida.nombre} de {elegida.unidades} u. · {p.rubro}
                </Texto>
              )}
            </View>

            {elegida && (
              <View style={e.filaPrecio}>
                <Animated.View style={{ transform: [{ scale: latido }] }}>
                  <Texto style={e.precioGrande}>
                    {elegida.precioUnitario} <Texto style={e.cu}>c/u</Texto>
                  </Texto>
                </Animated.View>
                {elegida.ahorra && (
                  <View style={e.masPorMenos}>
                    <Icono nombre="trending-down" tamano={16} color={COLOR.verde} />
                    <Texto style={e.textoMasPorMenos}>Más por menos</Texto>
                  </View>
                )}
              </View>
            )}

            <Tocable onPress={() => navigation.navigate('Vendedor', { id: p.mayorista.id })} style={e.vendedor} accessibilityRole="button">
              <View style={e.iconoVendedor}>
                <Icono nombre="storefront" tamano={18} color={COLOR.verde} />
              </View>
              <View style={{ flex: 1 }}>
                <Texto v="chico">Lo vende</Texto>
                <Texto v="fuerte">{p.mayorista.nombre}</Texto>
              </View>
              <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
            </Tocable>

            {opciones.length ? (
              <View style={{ gap: 10 }}>
                <Texto v="t3">Selecciona la presentación</Texto>
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
                        <Texto v="fuerte" style={{ fontSize: 13 }}>
                          {o.nombre}
                        </Texto>
                        <Texto v="chico">{o.unidades} u.</Texto>
                        <Texto v="precio" style={{ fontSize: 15 }}>
                          {o.precioUnitario}
                        </Texto>
                        <Texto v="chico">c/u</Texto>
                        {activa && (
                          <View style={e.check}>
                            <Icono nombre="checkmark" tamano={12} color="#fff" />
                          </View>
                        )}
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

            {p.abastecimiento === 'BAJO_PEDIDO' && (
              <View style={e.entrega}>
                <Icono nombre="time" color={COLOR.verde} />
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
                <Icono nombre="remove" color={cantidad <= 1 ? COLOR.texto3 : COLOR.verde} />
              </Tocable>
              <Texto v="t2" style={{ minWidth: 28, textAlign: 'center' }}>
                {cantidad}
              </Texto>
              <Tocable accessibilityRole="button" accessibilityLabel="Agregar uno" onPress={() => setCantidad((c) => c + 1)} style={[e.paso, e.pasoMas]}>
                <Icono nombre="add" color={COLOR.lima} />
              </Tocable>
            </View>
            <View style={{ flex: 1 }}>
              <Boton
                texto={sePuede ? `Agregar · ${bs(elegida.totalCentavos * cantidad)}` : 'Sin stock por ahora'}
                icono="cart"
                deshabilitado={!sePuede}
                alTocar={() => {
                  agregarAlCarrito(itemDeCarrito(p, escala, cantidad));
                  vibrar.exito();
                  setCantidad(1);
                }}
              />
            </View>
          </View>
          <Texto v="chico" style={{ textAlign: 'center' }}>
            {cantidadDe(elegida.presentacion, cantidad)} · {elegida.unidades * cantidad} u. en total
          </Texto>
        </SafeAreaView>
      )}
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.superficie },
  vitrina: { paddingHorizontal: 16, paddingBottom: 46, alignItems: 'center' },
  barraArriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  botonRedondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  imagen: { width: 250, height: 250 },
  cuerpo: { marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: COLOR.superficie, padding: 20, gap: 18 },
  filaPrecio: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  precioGrande: { fontFamily: FUENTE.negra, fontSize: 34, color: COLOR.texto, letterSpacing: -1 },
  cu: { fontFamily: FUENTE.fuerte, fontSize: 17, color: COLOR.texto2 },
  masPorMenos: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: COLOR.lima },
  textoMasPorMenos: { fontFamily: FUENTE.fuerte, fontSize: 12.5, color: COLOR.verde },
  vendedor: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: COLOR.fondo },
  iconoVendedor: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLOR.mentaClara, alignItems: 'center', justifyContent: 'center' },
  opciones: { flexDirection: 'row', gap: 8, paddingTop: 10 },
  opcion: { alignItems: 'center', gap: 1, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 4, borderRadius: 18, borderWidth: 2, borderColor: COLOR.borde, backgroundColor: COLOR.superficie },
  opcionActiva: { borderColor: COLOR.verde, backgroundColor: COLOR.lima },
  cinta: { position: 'absolute', top: -11, alignSelf: 'center', backgroundColor: COLOR.verde, paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: 'center' },
  textoCinta: { fontFamily: FUENTE.fuerte, fontSize: 10, color: '#fff' },
  check: { position: 'absolute', bottom: -9, alignSelf: 'center', width: 20, height: 20, borderRadius: 10, backgroundColor: COLOR.verde, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  entrega: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: COLOR.mentaClara },
  barra: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 6, backgroundColor: COLOR.superficie, borderTopLeftRadius: 26, borderTopRightRadius: 26, ...SOMBRA, shadowOffset: { width: 0, height: -6 } },
  filaBarra: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 18, backgroundColor: COLOR.fondo },
  paso: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pasoMas: { backgroundColor: COLOR.verde },
});
