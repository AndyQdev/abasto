import { useEspacioBarra } from '../BarraInferior';
import { filtrar, filtrarMayoristas, nombreCorto, opcionesDeCompra, ordenarMayoristas, rubros, textoDeStock, type Producto } from '@abasto/comercio';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BotonMas, Chip, Foto, Icono, Iniciales, Insignia, SinPrecio, Tarjeta, Texto, Vacio, Boton } from '../componentes';
import { useEstado } from '../estado';
import type { PantallaDePestana } from '../navegacion';
import { COLOR } from '../tema';

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Busca sobre el catálogo guardado en el teléfono: anda igual sin señal. Nunca se ordena por precio. */
export function Buscar({ navigation, route }: PantallaDePestana<'Buscar'>) {
  const espacio = useEspacioBarra();
  const { catalogo, enLinea, agregarRapido } = useEstado();
  const [texto, setTexto] = useState('');
  const [rubro, setRubro] = useState<string | null>(route.params?.rubro ?? null);
  const [modo, setModo] = useState<'productos' | 'vendedores'>(route.params?.modo ?? 'productos');

  // Al entrar desde un rubro o desde «Ver todos» de Inicio
  useEffect(() => {
    if (route.params?.rubro !== undefined) setRubro(route.params.rubro ?? null);
    if (route.params?.modo) setModo(route.params.modo);
  }, [route.params]);

  const productos = filtrar(catalogo.productos, { texto, rubro });
  const vendedores = ordenarMayoristas(filtrarMayoristas(catalogo.mayoristas, texto));
  const resultados = modo === 'productos' ? productos.length : vendedores.length;

  const cabecera = (
    <View style={{ gap: 12 }}>
      <View style={e.filaBuscador}>
        <View style={e.caja}>
          <Icono nombre="search" color={COLOR.texto3} />
          <TextInput
            accessibilityLabel="Buscar productos o vendedores"
            value={texto}
            onChangeText={setTexto}
            placeholder="Buscar productos o vendedores..."
            placeholderTextColor={COLOR.texto3}
            style={e.entrada}
            autoCorrect={false}
            returnKeyType="search"
          />
          {texto.length > 0 && (
            <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={() => setTexto('')} style={{ padding: 8 }}>
              <Icono nombre="close" tamano={18} color={COLOR.texto3} />
            </Pressable>
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Buscar con una foto" onPress={() => navigation.navigate('BuscarPorFoto')} style={e.camara}>
          <Icono nombre="camera-outline" color={COLOR.verde} tamano={22} />
        </Pressable>
        {/* IA local (src/ia): lista, receta o «quiero hacer 300 salteñas» → carrito */}
        <Pressable accessibilityRole="button" accessibilityLabel="Pídelo con tus palabras" onPress={() => navigation.navigate('Asistente')} style={e.camara}>
          <Icono nombre="sparkles-outline" color={COLOR.verde} tamano={22} />
        </Pressable>
      </View>

      <View style={e.segmentado}>
        <Chip texto="Productos" activo={modo === 'productos'} alTocar={() => setModo('productos')} />
        <Chip texto="Vendedores" activo={modo === 'vendedores'} alTocar={() => setModo('vendedores')} />
      </View>

      {modo === 'productos' && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...rubros(catalogo.productos)]}
          keyExtractor={(r) => r ?? 'todos'}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => <Chip texto={item ?? 'Todos'} activo={rubro === item} alTocar={() => setRubro(item)} />}
        />
      )}

      <Texto v="gris">
        <Texto v="fuerte">{resultados}</Texto> {resultados === 1 ? 'resultado' : 'resultados'}
      </Texto>
      {!enLinea && catalogo.actualizado && <Insignia texto={`Buscas en tu catálogo guardado del ${fecha(catalogo.actualizado)}`} color="ambar" />}
    </View>
  );

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      {modo === 'productos' ? (
        <FlatList
          data={productos}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[e.contenido, { paddingBottom: espacio }]}
          ListHeaderComponent={cabecera}
          ListEmptyComponent={
            <Vacio titulo="No encontramos productos" detalle="Prueba con otra palabra, quita algún filtro o busca con una foto.">
              <Boton
                tipo="chico"
                texto="Quitar filtros"
                alTocar={() => {
                  setTexto('');
                  setRubro(null);
                }}
              />
            </Vacio>
          }
          renderItem={({ item }) => <Resultado producto={item} alAbrir={() => navigation.navigate('Producto', { id: item.id })} alVendedor={() => navigation.navigate('Vendedor', { id: item.mayorista.id })} alAgregar={agregarRapido} />}
        />
      ) : (
        <FlatList
          data={vendedores}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[e.contenido, { paddingBottom: espacio }]}
          ListHeaderComponent={cabecera}
          ListEmptyComponent={<Vacio titulo="No encontramos vendedores con ese nombre" />}
          renderItem={({ item: m }) => (
            <Pressable onPress={() => navigation.navigate('Vendedor', { id: m.id })}>
              <Tarjeta style={e.vendedor}>
                <Iniciales nombre={m.nombre} tamano={48} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Texto v="fuerte">{m.nombre}</Texto>
                  <Texto v="gris">{m.ciudad}</Texto>
                  {m.deLaCasa ? <Insignia texto="Precios para todas las tiendas" /> : m.relacion === 'APROBADA' ? <Insignia texto="Eres cliente" /> : <Insignia texto="Verificado" color="gris" />}
                </View>
                <Icono nombre="chevron-forward" color={COLOR.texto3} />
              </Tarjeta>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Resultado({ producto: p, alAbrir, alVendedor, alAgregar }: { producto: Producto; alAbrir: () => void; alVendedor: () => void; alAgregar: (p: Producto) => void }) {
  const opciones = opcionesDeCompra(p);
  const stock = textoDeStock(p);
  return (
    <Tarjeta style={e.resultado}>
      <Foto producto={p} alto={88} ancho={76} alTocar={alAbrir} />
      <View style={{ flex: 1, gap: 5 }}>
        <Pressable onPress={alAbrir}>
          <Texto v="fuerte">{p.nombre}</Texto>
          <Texto v="gris">{p.rubro}</Texto>
        </Pressable>
        <Pressable onPress={alVendedor} style={e.enlaceVendedor}>
          <Icono nombre="storefront-outline" tamano={14} color={COLOR.verdeTexto} />
          <Texto style={{ color: COLOR.verdeTexto, fontWeight: '600', fontSize: 12 }}>{nombreCorto(p.mayorista.nombre)}</Texto>
        </Pressable>
        {opciones.length ? (
          <>
            <View style={e.escalas}>
              <View style={e.precios}>
                {opciones.map((o) => (
                  <View key={o.presentacion} style={{ flex: 1 }}>
                    <Texto v="chico">{o.nombre}</Texto>
                    <Texto v="precio" style={{ fontSize: 13 }}>
                      {o.precioUnitario}
                    </Texto>
                  </View>
                ))}
              </View>
              <BotonMas producto={p} alAgregar={alAgregar} />
            </View>
            <Texto v="chico">Precio por unidad · {stock.texto}</Texto>
          </>
        ) : (
          <SinPrecio />
        )}
      </View>
    </Tarjeta>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 10, paddingBottom: 32 },
  filaBuscador: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  caja: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 15, borderWidth: 1, borderColor: COLOR.borde, backgroundColor: COLOR.superficie, paddingLeft: 12 },
  entrada: { flex: 1, height: '100%', paddingHorizontal: 10, fontSize: 15, color: COLOR.texto },
  camara: { width: 48, height: 48, borderRadius: 15, borderWidth: 1, borderColor: COLOR.borde, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center' },
  segmentado: { flexDirection: 'row', gap: 6 },
  resultado: { flexDirection: 'row', gap: 12, padding: 12 },
  enlaceVendedor: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  escalas: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  precios: { flex: 1, flexDirection: 'row', gap: 4 },
  vendedor: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
});
