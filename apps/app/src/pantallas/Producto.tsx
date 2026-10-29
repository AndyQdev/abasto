import { bs, cantidadDe, disponible, escalaPorDefecto, escalasConPrecio, itemDeCarrito, opcionesDeCompra, textoDeStock } from '@abasto/comercio';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, colorDeClase, Foto, Icono, Insignia, PedirSerCliente, Tarjeta, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import type { PantallaDePila } from '../navegacion';
import { COLOR } from '../tema';

/** Detalle con los precios por volumen (cuarta, docena, caja, fardo) y cuándo llega. */
export function Producto({ navigation, route }: PantallaDePila<'Producto'>) {
  const { catalogo, enLinea, agregarAlCarrito, pedirSerCliente } = useEstado();
  const p = catalogo.productos.find((x) => x.id === route.params.id);
  const [presentacion, setPresentacion] = useState(p ? (escalaPorDefecto(p)?.presentacion ?? null) : null);
  const [cantidad, setCantidad] = useState(1);

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

  return (
    <SafeAreaView style={e.pantalla} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View>
          <Foto producto={p} alto={260} ancho="100%" />
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => navigation.goBack()} style={e.volver}>
            <Icono nombre="chevron-back" />
          </Pressable>
        </View>
        <View style={e.cuerpo}>
          <View style={{ gap: 6 }}>
            <Texto v="t1">{p.nombre}</Texto>
            <Texto v="gris">
              {p.rubro} · {p.codigo}
            </Texto>
            <View style={e.entre}>
              <Pressable onPress={() => navigation.navigate('Vendedor', { id: p.mayorista.id })} style={e.vendedor}>
                <Icono nombre="storefront-outline" tamano={16} color={COLOR.verdeTexto} />
                <Texto v="fuerte" style={{ color: COLOR.verdeTexto }}>
                  {p.mayorista.nombre}
                </Texto>
                <Icono nombre="chevron-forward" tamano={16} color={COLOR.verdeTexto} />
              </Pressable>
              <Insignia texto={stock.texto} color={colorDeClase(stock.clase)} />
            </View>
          </View>

          {opciones.length ? (
            <Tarjeta style={{ gap: 12 }}>
              <Texto v="t3">Precios por volumen</Texto>
              <View style={e.opciones} accessibilityRole="radiogroup" accessibilityLabel="Presentación">
                {opciones.map((o) => {
                  const activa = o.presentacion === presentacion;
                  return (
                    <Pressable
                      key={o.presentacion}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: activa }}
                      onPress={() => setPresentacion(o.presentacion)}
                      style={[e.opcion, activa && { borderColor: COLOR.verde, backgroundColor: COLOR.verdeSuave }]}
                    >
                      <Texto v="fuerte" style={{ color: COLOR.texto2, fontSize: 12.5 }}>
                        {o.nombre}
                      </Texto>
                      <Texto v="precio" style={{ fontSize: 17 }}>
                        {o.precioUnitario}
                      </Texto>
                      <Texto v="chico">c/u · {o.unidades} u.</Texto>
                      <Texto v="fuerte" style={{ fontSize: 12.5 }}>
                        {o.total}
                      </Texto>
                      <Insignia texto={o.ahorro} color={o.ahorra ? 'verde' : 'gris'} />
                    </Pressable>
                  );
                })}
              </View>
              {elegida && (
                <View style={e.entre}>
                  <View style={e.contador} accessibilityLabel="Cantidad">
                    <Pressable accessibilityRole="button" accessibilityLabel="Quitar uno" disabled={cantidad <= 1} onPress={() => setCantidad((c) => c - 1)} style={e.paso}>
                      <Icono nombre="remove" color={cantidad <= 1 ? COLOR.texto3 : COLOR.texto} />
                    </Pressable>
                    <Texto v="t2" style={{ minWidth: 34, textAlign: 'center' }}>
                      {cantidad}
                    </Texto>
                    <Pressable accessibilityRole="button" accessibilityLabel="Agregar uno" onPress={() => setCantidad((c) => c + 1)} style={e.paso}>
                      <Icono nombre="add" />
                    </Pressable>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Texto v="fuerte">{cantidadDe(elegida.presentacion, cantidad)}</Texto>
                    <Texto v="gris">{elegida.unidades * cantidad} u. en total</Texto>
                  </View>
                </View>
              )}
            </Tarjeta>
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
            <Tarjeta style={e.entrega}>
              <Icono nombre="time-outline" color={COLOR.verde} />
              <Texto style={{ flex: 1, color: COLOR.texto2 }}>
                Lo compramos cuando haces el pedido. Llega en {p.entregaHoras ?? 24} horas.
              </Texto>
            </Tarjeta>
          )}

          {!!p.descripcion && (
            <View style={{ gap: 6 }}>
              <Texto v="t3">Descripción</Texto>
              <Texto style={{ color: COLOR.texto2 }}>{p.descripcion}</Texto>
            </View>
          )}
        </View>
      </ScrollView>

      {elegida && escala && (
        <View style={e.barra}>
          <Boton
            texto={sePuede ? `Agregar al carrito · ${bs(elegida.totalCentavos * cantidad)}` : 'Sin stock por ahora'}
            deshabilitado={!sePuede}
            alTocar={() => {
              agregarAlCarrito(itemDeCarrito(p, escala, cantidad));
              setCantidad(1);
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  volver: { position: 'absolute', top: 48, left: 14, width: 44, height: 44, borderRadius: 14, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center' },
  cuerpo: { marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: COLOR.fondo, padding: 16, gap: 16 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  vendedor: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  opciones: { flexDirection: 'row', gap: 8 },
  opcion: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie },
  contador: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLOR.borde, borderRadius: 14, backgroundColor: COLOR.superficie },
  paso: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  entrega: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barra: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLOR.borde, backgroundColor: COLOR.fondo },
});
