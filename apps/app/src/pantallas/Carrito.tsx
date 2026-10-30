import { ILUSTRACION } from '../ilustraciones';
import { bs, cambiarCantidad, nombreDe, porMayorista, productos as cuantosProductos, quitar, totalDe, unidadesDe } from '@abasto/comercio';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Iniciales, Icono, Insignia, Tarjeta, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import type { PantallaDePestana } from '../navegacion';
import { COLOR } from '../tema';

/** El carrito vive en el teléfono y se cambia sin señal. Sale un pedido por vendedor. */
export function Carrito({ navigation }: PantallaDePestana<'Carrito'>) {
  const { carrito, cambiarCarrito, enLinea } = useEstado();
  const grupos = porMayorista(carrito);
  const total = grupos.reduce((s, g) => s + g.totalEstimadoCentavos, 0);
  const unidades = carrito.reduce((s, i) => s + unidadesDe(i), 0);

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={e.contenido}>
        <View style={e.entre}>
          <Texto v="t1">Tu carrito ({carrito.length})</Texto>
          {carrito.length > 0 && (
            <Pressable accessibilityRole="button" onPress={() => cambiarCarrito([])}>
              <Texto style={{ color: COLOR.rojoTexto, fontWeight: '700', textDecorationLine: 'underline' }}>Vaciar</Texto>
            </Pressable>
          )}
        </View>
        {!enLinea && <Insignia texto="Puedes cambiar tu carrito sin señal" color="ambar" />}

        {!carrito.length && (
          <Vacio imagen={ILUSTRACION.vacioCarrito} titulo="Tu carrito está vacío" detalle="Busca productos y agrégalos por docena, caja o fardo.">
            <Boton tipo="chico" texto="Buscar productos" alTocar={() => navigation.navigate('Buscar')} />
          </Vacio>
        )}

        {grupos.map((g) => (
          <Tarjeta key={g.mayoristaId} style={{ gap: 0 }}>
            <View style={e.cabezaGrupo}>
              <Iniciales nombre={g.mayoristaNombre} tamano={36} />
              <View style={{ flex: 1 }}>
                <Texto v="t3">{g.mayoristaNombre}</Texto>
                <Texto v="gris">Pedido aparte</Texto>
              </View>
            </View>
            {g.items.map((i) => (
              <View key={`${i.productoId}-${i.presentacion}`} style={e.item}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={e.entre}>
                    <View style={{ flex: 1 }}>
                      <Texto v="fuerte">{i.nombre}</Texto>
                      <Texto v="gris">
                        {nombreDe(i.presentacion)} · {i.precioUnitarioCentavos ? `${bs(i.precioUnitarioCentavos)} c/u` : 'precio al reservar'}
                      </Texto>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Texto v="fuerte">{bs(totalDe(i))}</Texto>
                      <Texto v="gris">{unidadesDe(i)} u.</Texto>
                    </View>
                  </View>
                  <View style={e.entre}>
                    <View style={e.contador} accessibilityLabel={`Cantidad de ${i.nombre}`}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Quitar uno"
                        disabled={i.cantidad <= 1}
                        onPress={() => cambiarCarrito(cambiarCantidad(carrito, i.productoId, i.presentacion, -1))}
                        style={e.paso}
                      >
                        <Icono nombre="remove" tamano={18} color={i.cantidad <= 1 ? COLOR.texto3 : COLOR.texto} />
                      </Pressable>
                      <Texto v="fuerte" style={{ minWidth: 24, textAlign: 'center' }}>
                        {i.cantidad}
                      </Texto>
                      <Pressable accessibilityRole="button" accessibilityLabel="Agregar uno" onPress={() => cambiarCarrito(cambiarCantidad(carrito, i.productoId, i.presentacion, 1))} style={e.paso}>
                        <Icono nombre="add" tamano={18} />
                      </Pressable>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${i.nombre}`} onPress={() => cambiarCarrito(quitar(carrito, i.productoId, i.presentacion))} style={e.paso}>
                      <Icono nombre="trash-outline" tamano={20} color={COLOR.rojoTexto} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
            <View style={[e.entre, e.pie]}>
              <Texto style={{ color: COLOR.texto2 }}>Subtotal</Texto>
              <Texto v="fuerte">{bs(g.totalEstimadoCentavos)}</Texto>
            </View>
          </Tarjeta>
        ))}

        {carrito.length > 0 && (
          <>
            <Tarjeta style={{ gap: 8 }}>
              <View style={e.entre}>
                <Texto style={{ color: COLOR.texto2 }}>
                  {cuantosProductos(carrito.length)} · {unidades} u.
                </Texto>
                <Texto>{bs(total)}</Texto>
              </View>
              <View style={e.entre}>
                <Texto v="fuerte">Total estimado</Texto>
                <Texto v="t1">{bs(total)}</Texto>
              </View>
              <Texto v="gris">
                {grupos.length === 1 ? '1 pedido.' : `${grupos.length} pedidos: uno por cada vendedor.`} El precio final se confirma al reservar.
              </Texto>
            </Tarjeta>
            <Boton texto="Continuar pedido" alTocar={() => navigation.navigate('Finalizar')} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 14, paddingBottom: 32 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cabezaGrupo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLOR.borde },
  contador: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLOR.borde, borderRadius: 12 },
  paso: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  pie: { paddingTop: 10, borderTopWidth: 1, borderTopColor: COLOR.borde },
});
