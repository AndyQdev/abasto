import { bs, cambiarCantidad, nombreDe, quitar, tinte, totalDe, unidadesDe, type ItemDeCarrito } from '@abasto/comercio';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { HojaInferior, Tocable, vibrar } from './animacion';
import { Boton, Icono, Texto } from './componentes';
import { useEstado } from './estado';
import { fotoDe } from './ilustraciones';
import { irAlCarrito } from './navegar';
import { COLOR, FUENTE, TINTES } from './tema';

const claveDe = (i: Pick<ItemDeCarrito, 'productoId' | 'presentacion'>) => `${i.productoId}-${i.presentacion}`;

/**
 * La hoja del carrito (02/11, pedido del usuario): al agregar desde la ficha se abre sola con todo lo que llevas, lo
 * recién agregado arriba y resaltado. Se suma, se resta o se quita ahí mismo, sin salir del producto.
 * También se abre con el botón del carrito de la ficha.
 */
export function HojaDelCarrito() {
  const { carrito, cambiarCarrito, catalogo, hojaCarrito, cerrarCarrito } = useEstado();
  const { height } = useWindowDimensions();
  const resaltado = hojaCarrito.resaltado;
  const items = [...carrito].sort((a, b) => Number(claveDe(b) === resaltado) - Number(claveDe(a) === resaltado));
  const total = carrito.reduce((s, i) => s + totalDe(i), 0);
  const unidades = carrito.reduce((s, i) => s + unidadesDe(i), 0);
  const delCatalogo = (id: string) => catalogo.productos.find((p) => p.id === id) ?? { rubro: 'Varios', foto: null };
  const recien = carrito.find((i) => claveDe(i) === resaltado);

  const cambiar = (i: ItemDeCarrito, d: number) => {
    vibrar.toque();
    cambiarCarrito(i.cantidad + d <= 0 ? quitar(carrito, i.productoId, i.presentacion) : cambiarCantidad(carrito, i.productoId, i.presentacion, d));
  };

  return (
    <HojaInferior visible={hojaCarrito.visible} alCerrar={cerrarCarrito}>
      <View style={{ gap: 14 }}>
        <View style={e.cabeza}>
          {recien ? (
            <View style={e.listo}>
              <Icono nombre="checkmark" tamano={16} color={COLOR.bosque} />
            </View>
          ) : (
            <Icono nombre="cart" tamano={22} color={COLOR.bosque} />
          )}
          <View style={{ flex: 1 }}>
            <Texto style={e.titulo}>{recien ? '¡Agregado a tu carrito!' : 'Tu carrito'}</Texto>
            <Texto v="gris">
              {carrito.length} {carrito.length === 1 ? 'producto' : 'productos'} · {unidades} u.
            </Texto>
          </View>
          <Tocable onPress={cerrarCarrito} style={e.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Icono nombre="close" tamano={20} color={COLOR.bosque} />
          </Tocable>
        </View>

        {carrito.length ? (
          <ScrollView style={{ maxHeight: Math.max(220, height * 0.42) }} contentContainerStyle={{ gap: 10 }}>
            {items.map((i) => {
              const p = delCatalogo(i.productoId);
              const esElNuevo = claveDe(i) === resaltado;
              return (
                <View key={claveDe(i)} style={[e.item, esElNuevo && e.itemNuevo]}>
                  <View style={[e.foto, { backgroundColor: p.foto ? COLOR.superficie : TINTES[tinte(p.rubro)] }]}>
                    <Image source={fotoDe(p)} style={{ width: 46, height: 46 }} contentFit="contain" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Texto v="fuerte" lineas={2} style={{ fontSize: 14 }}>
                      {i.nombre}
                    </Texto>
                    <Texto v="chico">
                      {nombreDe(i.presentacion)} de {i.unidadesPorPresentacion} u. · {bs(totalDe(i))}
                    </Texto>
                  </View>
                  <View style={e.contador}>
                    <Tocable onPress={() => cambiar(i, -1)} style={e.paso} accessibilityRole="button" accessibilityLabel={i.cantidad <= 1 ? `Quitar ${i.nombre}` : `Uno menos de ${i.nombre}`}>
                      <Icono nombre={i.cantidad <= 1 ? 'trash-outline' : 'remove'} tamano={17} color={i.cantidad <= 1 ? COLOR.rojoTexto : COLOR.bosque} />
                    </Tocable>
                    <Texto style={e.cantidad}>{i.cantidad}</Texto>
                    <Tocable onPress={() => cambiar(i, 1)} style={[e.paso, e.pasoMas]} accessibilityRole="button" accessibilityLabel={`Uno más de ${i.nombre}`}>
                      <Icono nombre="add" tamano={17} color={COLOR.bosque} />
                    </Tocable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={e.vacio}>
            <Icono nombre="cart-outline" tamano={22} color={COLOR.texto3} />
            <Texto v="gris">Tu carrito quedó vacío.</Texto>
          </View>
        )}

        {carrito.length > 0 && (
          <View style={e.total}>
            <Texto v="gris">Total estimado</Texto>
            <Texto style={e.monto}>{bs(total)}</Texto>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Boton tipo="secundario" texto="Seguir comprando" alTocar={cerrarCarrito} />
          </View>
          {carrito.length > 0 && (
            <View style={{ flex: 1.2 }}>
              <Boton
                tipo="oscuro"
                texto="Ver carrito"
                icono="arrow-forward"
                alTocar={() => {
                  cerrarCarrito();
                  irAlCarrito();
                }}
              />
            </View>
          )}
        </View>
      </View>
    </HojaInferior>
  );
}

const e = StyleSheet.create({
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listo: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: FUENTE.negra, fontSize: 20, color: COLOR.texto, letterSpacing: -0.4 },
  cerrar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLOR.tenue, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 18, backgroundColor: COLOR.superficie, borderWidth: 1.5, borderColor: COLOR.borde },
  itemNuevo: { borderColor: COLOR.lima, backgroundColor: COLOR.limaSuave },
  foto: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 3, borderRadius: 14, backgroundColor: COLOR.fondo },
  paso: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pasoMas: { backgroundColor: COLOR.lima },
  cantidad: { minWidth: 22, textAlign: 'center', fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.texto },
  vacio: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: COLOR.tenue },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTopWidth: 1, borderTopColor: COLOR.borde },
  monto: { fontFamily: FUENTE.negra, fontSize: 22, color: COLOR.bosque, letterSpacing: -0.5 },
});
