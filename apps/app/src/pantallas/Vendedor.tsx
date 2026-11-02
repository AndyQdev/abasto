import { bs, escalaPorDefecto, filtrar, nombreCorto } from '@abasto/comercio';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Foto, Icono, Iniciales, Insignia, PedirSerCliente, Tarjeta, Texto, Vacio } from '../componentes';
import { BotonAgregar } from '../BotonAgregar';
import { useEstado } from '../estado';
import type { PantallaDePila } from '../navegacion';
import { COLOR } from '../tema';

/** Perfil de un vendedor con su catálogo. Abasto le vende a todas; un afiliado, a las tiendas que aprueba. */
export function Vendedor({ navigation, route }: PantallaDePila<'Vendedor'>) {
  const { catalogo, enLinea, pedirSerCliente, agregarRapido } = useEstado();
  const m = catalogo.mayoristas.find((x) => x.id === route.params.id);

  if (!m) {
    return (
      <SafeAreaView style={e.pantalla}>
        <View style={{ padding: 16 }}>
          <Vacio titulo="No encontramos este vendedor">
            <Boton tipo="chico" texto="Volver" alTocar={() => navigation.goBack()} />
          </Vacio>
        </View>
      </SafeAreaView>
    );
  }

  const productos = filtrar(catalogo.productos, { mayoristaId: m.id });
  const puedeComprar = m.relacion === 'APROBADA' || m.deLaCasa;

  return (
    <SafeAreaView style={e.pantalla} edges={['bottom']}>
      <FlatList
        data={productos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <View style={e.portada}>
              <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => navigation.goBack()} style={e.volver}>
                <Icono nombre="chevron-back" />
              </Pressable>
            </View>
            <View style={e.cuerpo}>
              <View style={e.marca}>
                <View style={e.bordeIniciales}>
                  <Iniciales nombre={m.nombre} tamano={64} oscuro />
                </View>
                {m.verificado && <Insignia texto="Vendedor verificado" />}
              </View>
              <Texto v="t1">{m.nombre}</Texto>
              <Texto v="gris">{m.ciudad}</Texto>
              {puedeComprar ? (
                <Insignia texto={m.deLaCasa && m.relacion !== 'APROBADA' ? 'Le vende a todas las tiendas · pide hoy y te lo llevamos' : 'Eres cliente · ves los precios de tu lista'} />
              ) : (
                <PedirSerCliente
                  mayorista={m}
                  enLinea={enLinea}
                  alPedir={pedirSerCliente}
                  titulo={`Todavía no eres cliente de ${nombreCorto(m.nombre)}`}
                  detalle="Cuando te apruebe, verás sus precios y podrás comprar."
                />
              )}
              <Texto v="t2" style={{ marginTop: 8 }}>
                Catálogo · {productos.length} productos
              </Texto>
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item: p }) => {
          const escala = escalaPorDefecto(p);
          return (
            <View style={{ paddingHorizontal: 16 }}>
              <Tarjeta style={e.fila}>
                <Foto producto={p} alto={60} ancho={60} alTocar={() => navigation.navigate('Producto', { id: p.id })} />
                <Pressable style={{ flex: 1, gap: 2 }} onPress={() => navigation.navigate('Producto', { id: p.id })}>
                  <Texto v="fuerte" lineas={2}>
                    {p.nombre}
                  </Texto>
                  <Texto v="gris">{p.rubro}</Texto>
                  {escala?.precioUnitario ? (
                    <Texto v="chico">
                      <Texto v="precio" style={{ fontSize: 13 }}>
                        {bs(escala.precioUnitario.centavos * escala.cantidad)}
                      </Texto>{' '}
                      la {escala.presentacion.toLowerCase()} · {escala.precioUnitario.texto} c/u
                    </Texto>
                  ) : (
                    <Texto v="gris">Precio para clientes</Texto>
                  )}
                </Pressable>
                <BotonAgregar producto={p} alAgregar={agregarRapido} oscuro={false} />
              </Tarjeta>
            </View>
          );
        }}
        ListEmptyComponent={<Texto v="gris" style={{ padding: 16 }}>Este vendedor todavía no publicó productos.</Texto>}
      />
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  portada: { height: 150, backgroundColor: '#D7E5DD' },
  volver: { position: 'absolute', top: 48, left: 14, width: 44, height: 44, borderRadius: 14, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center' },
  cuerpo: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  marca: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: -32 },
  bordeIniciales: { borderWidth: 4, borderColor: COLOR.fondo, borderRadius: 24 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
});
