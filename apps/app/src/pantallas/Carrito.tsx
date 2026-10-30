import { bs, cambiarCantidad, nombreDe, porMayorista, productos as cuantosProductos, quitar, tinte, totalDe, unidadesDe } from '@abasto/comercio';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Tocable, vibrar } from '../animacion';
import { Boton, Icono, Insignia, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import { ILUSTRACION, imagenDeRubro } from '../ilustraciones';
import type { PantallaDePestana } from '../navegacion';
import { COLOR, FUENTE, SOMBRA, TINTES } from '../tema';

/** El carrito vive en el teléfono y se cambia sin señal. Sale un pedido por mayorista. */
export function Carrito({ navigation }: PantallaDePestana<'Carrito'>) {
  const { carrito, cambiarCarrito, enLinea, catalogo } = useEstado();
  const grupos = porMayorista(carrito);
  const total = grupos.reduce((s, g) => s + g.totalEstimadoCentavos, 0);
  const unidades = carrito.reduce((s, i) => s + unidadesDe(i), 0);
  const rubroDe = (id: string) => catalogo.productos.find((p) => p.id === id)?.rubro ?? 'Varios';

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={[e.contenido, carrito.length > 0 && { paddingBottom: 200 }]}>
        <View style={e.entre}>
          <Texto v="t1">Tu carrito ({carrito.length})</Texto>
          {carrito.length > 0 && (
            <Tocable accessibilityRole="button" accessibilityLabel="Vaciar el carrito" onPress={() => cambiarCarrito([])} style={e.vaciar}>
              <Icono nombre="trash-outline" tamano={20} color={COLOR.rojoTexto} />
            </Tocable>
          )}
        </View>
        {!enLinea && <Insignia texto="Puedes cambiar tu carrito sin señal" color="ambar" />}

        {!carrito.length && (
          <Vacio imagen={ILUSTRACION.vacioCarrito} titulo="Tu carrito está vacío" detalle="Busca productos y agrégalos por docena, caja o fardo.">
            <Boton tipo="chico" texto="Buscar productos" alTocar={() => navigation.navigate('Buscar')} />
          </Vacio>
        )}

        {grupos.map((g, n) => (
          <Aparecer key={g.mayoristaId} orden={n}>
            <View style={e.grupo}>
              <Tocable onPress={() => navigation.navigate('Vendedor', { id: g.mayoristaId })} style={e.cabezaGrupo} accessibilityRole="button">
                <View style={e.iconoTienda}>
                  <Icono nombre="storefront" tamano={18} color={COLOR.verde} />
                </View>
                <Texto v="t3" style={{ flex: 1 }} lineas={1}>
                  {g.mayoristaNombre}
                </Texto>
                <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
              </Tocable>
              {g.items.map((i) => {
                const rubro = rubroDe(i.productoId);
                return (
                  <View key={`${i.productoId}-${i.presentacion}`} style={e.item}>
                    <View style={[e.miniatura, { backgroundColor: TINTES[tinte(rubro)] }]}>
                      <Image source={imagenDeRubro(rubro)} style={{ width: 52, height: 52 }} contentFit="contain" />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={e.entre}>
                        <View style={{ flex: 1 }}>
                          <Texto v="fuerte" lineas={2}>
                            {i.nombre}
                          </Texto>
                          <Texto v="chico">
                            {nombreDe(i.presentacion)} de {i.unidadesPorPresentacion} u.
                          </Texto>
                        </View>
                        <Texto v="precio" style={{ fontSize: 15 }}>
                          {bs(totalDe(i))}
                        </Texto>
                      </View>
                      <View style={e.entre}>
                        <View style={e.contador} accessibilityLabel={`Cantidad de ${i.nombre}`}>
                          <Tocable
                            accessibilityRole="button"
                            accessibilityLabel={i.cantidad <= 1 ? `Quitar ${i.nombre}` : 'Quitar uno'}
                            onPress={() =>
                              cambiarCarrito(i.cantidad <= 1 ? quitar(carrito, i.productoId, i.presentacion) : cambiarCantidad(carrito, i.productoId, i.presentacion, -1))
                            }
                            style={e.paso}
                          >
                            <Icono nombre={i.cantidad <= 1 ? 'trash-outline' : 'remove'} tamano={17} color={i.cantidad <= 1 ? COLOR.rojoTexto : COLOR.verde} />
                          </Tocable>
                          <Texto v="fuerte" style={{ minWidth: 22, textAlign: 'center' }}>
                            {i.cantidad}
                          </Texto>
                          <Tocable
                            accessibilityRole="button"
                            accessibilityLabel="Agregar uno"
                            onPress={() => cambiarCarrito(cambiarCantidad(carrito, i.productoId, i.presentacion, 1))}
                            style={[e.paso, e.pasoMas]}
                          >
                            <Icono nombre="add" tamano={18} color={COLOR.bosque} />
                          </Tocable>
                        </View>
                        <Texto v="chico">
                          {i.cantidad} {nombreDe(i.presentacion).toLowerCase()} · {unidadesDe(i)} u.
                        </Texto>
                      </View>
                    </View>
                  </View>
                );
              })}
              <View style={[e.entre, e.subtotal]}>
                <Texto v="gris">Subtotal de este mayorista</Texto>
                <Texto v="fuerte">{bs(g.totalEstimadoCentavos)}</Texto>
              </View>
            </View>
          </Aparecer>
        ))}

        {carrito.length > 0 && (
          <View style={e.pagos}>
            <Texto v="t3">Puedes pagar con</Texto>
            <View style={e.filaPagos}>
              {[
                { icono: 'qr-code' as const, texto: 'QR' },
                { icono: 'cash' as const, texto: 'Contra entrega' },
                { icono: 'card' as const, texto: 'Crédito' },
              ].map((m) => (
                <View key={m.texto} style={[e.pago, m.texto === 'QR' && e.pagoDestacado]}>
                  <Icono nombre={m.icono} tamano={22} color={COLOR.bosque} />
                  <Texto v="fuerte" style={{ fontSize: 12.5 }}>
                    {m.texto}
                  </Texto>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {carrito.length > 0 && (
        <View style={e.barra}>
          <View style={e.entre}>
            <Texto v="gris">
              Total ({cuantosProductos(carrito.length)} · {unidades} u.)
            </Texto>
            <Texto style={e.total}>{bs(total)}</Texto>
          </View>
          <Boton
            tipo="oscuro"
            texto={`Continuar · ${bs(total)}`}
            icono="arrow-forward"
            alTocar={() => {
              vibrar.toque();
              navigation.navigate('Finalizar');
            }}
          />
          <Texto v="chico" style={{ textAlign: 'center' }}>
            {grupos.length === 1 ? 'Sale 1 pedido.' : `Salen ${grupos.length} pedidos, uno por mayorista.`} El precio final se confirma al reservar.
          </Texto>
        </View>
      )}
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 14, paddingBottom: 32 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  vaciar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLOR.rojoSuave, alignItems: 'center', justifyContent: 'center' },
  grupo: { backgroundColor: COLOR.superficie, borderRadius: 24, padding: 14, gap: 4, ...SOMBRA },
  cabezaGrupo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  iconoTienda: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLOR.borde },
  miniatura: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 3, borderRadius: 14, backgroundColor: COLOR.fondo },
  paso: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pasoMas: { backgroundColor: COLOR.lima },
  subtotal: { paddingTop: 10, borderTopWidth: 1, borderTopColor: COLOR.borde },
  pagos: { gap: 10 },
  filaPagos: { flexDirection: 'row', gap: 8 },
  pago: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 20, backgroundColor: COLOR.superficie, borderWidth: 2, borderColor: COLOR.superficie, ...SOMBRA },
  pagoDestacado: { backgroundColor: COLOR.lima, borderColor: COLOR.bosque },
  barra: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 14, gap: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: COLOR.superficie, ...SOMBRA, shadowOffset: { width: 0, height: -6 } },
  total: { fontFamily: FUENTE.negra, fontSize: 26, color: COLOR.bosque, letterSpacing: -0.6 },
  continuar: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 20, borderRadius: 18, backgroundColor: COLOR.lima },
});
