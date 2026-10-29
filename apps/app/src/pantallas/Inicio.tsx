import { bs, comprables, nombreCorto, ordenarMayoristas, precioDesde, rubros, type Producto } from '@abasto/comercio';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BotonMas, Chip, Falla, Foto, Icono, Iniciales, Insignia, Seccion, SinPrecio, Tarjeta, Texto } from '../componentes';
import { useEstado } from '../estado';
import type { PantallaDePestana } from '../navegacion';
import { useSesion } from '../sesion';
import { COLOR, SOMBRA } from '../tema';

/** Inicio, estilo vitrina: buscador con foto, rubros, destacados, vendedores y ofertas por caja. */
export function Inicio({ navigation }: PantallaDePestana<'Inicio'>) {
  const { usuario } = useSesion();
  const { catalogo, carrito, enLinea, agregarRapido } = useEstado();
  const productos = comprables(catalogo.productos);
  // Primero lo que se puede comprar ya (Abasto le vende a todas las tiendas)
  const destacados = [...productos].sort((a, b) => Number(b.precioVisible) - Number(a.precioVisible)).slice(0, 10);
  const ofertas = productos.filter((p) => p.precioVisible && p.escalas.some((e) => e.presentacion === 'CAJA' || e.presentacion === 'FARDO')).slice(0, 5);
  const vendedores = ordenarMayoristas(catalogo.mayoristas);
  const cuantos = (id: string) => productos.filter((p) => p.mayorista.id === id).length;
  const abrir = (p: Producto) => navigation.navigate('Producto', { id: p.id });

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      {!enLinea && <AvisoSinSenal />}
      <ScrollView contentContainerStyle={e.contenido} refreshControl={<RefreshControl refreshing={catalogo.cargando} onRefresh={() => void catalogo.recargar()} />}>
        <View style={e.cabecera}>
          <View style={{ flex: 1 }}>
            <Texto v="titulo">Abasto</Texto>
            <Texto v="gris" lineas={1}>
              {usuario?.orgNombre} · Santa Cruz
            </Texto>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Carrito, ${carrito.length} productos`} onPress={() => navigation.navigate('Carrito')} style={e.icono}>
            <Icono nombre="cart-outline" tamano={22} />
            {carrito.length > 0 && (
              <View style={e.insigniaNum}>
                <Texto style={e.num}>{carrito.length}</Texto>
              </View>
            )}
          </Pressable>
        </View>

        <View style={e.buscador}>
          <Pressable accessibilityRole="search" style={e.buscadorTexto} onPress={() => navigation.navigate('Buscar')}>
            <Icono nombre="search" color={COLOR.texto3} />
            <Texto v="gris" style={{ fontSize: 14 }}>
              Buscar productos o vendedores...
            </Texto>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Buscar con una foto" onPress={() => navigation.navigate('BuscarPorFoto')} style={e.camara}>
            <Icono nombre="camera-outline" color={COLOR.verde} tamano={24} />
          </Pressable>
        </View>

        <View style={e.portada}>
          <Texto v="t1" style={{ color: '#fff', maxWidth: 230 }}>
            Precios de mayoreo para tu tienda
          </Texto>
          <Texto style={{ color: 'rgba(255,255,255,0.85)', maxWidth: 230 }}>Abarrotes, bebidas, limpieza y más. Pide hoy y te lo llevamos.</Texto>
          <Pressable accessibilityRole="button" style={e.botonPortada} onPress={() => navigation.navigate('Buscar')}>
            <Texto v="fuerte" style={{ color: COLOR.tinta }}>
              Ver el catálogo
            </Texto>
            <Icono nombre="chevron-forward" tamano={16} color={COLOR.tinta} />
          </Pressable>
          <View style={[e.caja, { right: 18, bottom: 54, backgroundColor: COLOR.ambar }]} />
          <View style={[e.caja, { right: 70, bottom: 18, backgroundColor: COLOR.verde }]} />
          <View style={[e.caja, { right: 8, bottom: 6, backgroundColor: '#2C8F69' }]} />
        </View>

        {catalogo.error && !productos.length && <Falla texto={catalogo.error} />}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.fila}>
          {rubros(catalogo.productos).map((r) => (
            <Chip key={r} texto={r} alTocar={() => navigation.navigate('Buscar', { rubro: r })} />
          ))}
        </ScrollView>

        <Seccion titulo="Productos destacados" enlace="Ver todos" alTocarEnlace={() => navigation.navigate('Buscar')}>
          {!destacados.length && <Texto v="gris">{catalogo.cargando ? 'Cargando el catálogo…' : 'Todavía no hay productos para mostrar.'}</Texto>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.fila}>
            {destacados.map((p) => {
              const desde = precioDesde(p);
              return (
                <Tarjeta key={p.id} style={e.destacado}>
                  <Foto producto={p} alto={100} ancho="100%" alTocar={() => abrir(p)} />
                  <Pressable onPress={() => abrir(p)}>
                    <Texto v="fuerte" lineas={2}>
                      {p.nombre}
                    </Texto>
                  </Pressable>
                  <Texto v="gris">{nombreCorto(p.mayorista.nombre)}</Texto>
                  <View style={e.pie}>
                    {desde ? (
                      <>
                        <View>
                          <Texto v="chico">desde</Texto>
                          <Texto v="precio">{desde.precioUnitario!.texto}</Texto>
                          <Texto v="chico">c/u por {desde.presentacion.toLowerCase()}</Texto>
                        </View>
                        <BotonMas producto={p} alAgregar={agregarRapido} />
                      </>
                    ) : (
                      <SinPrecio />
                    )}
                  </View>
                </Tarjeta>
              );
            })}
          </ScrollView>
        </Seccion>

        <Seccion titulo="Vendedores" enlace="Ver todos" alTocarEnlace={() => navigation.navigate('Buscar', { modo: 'vendedores' })}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.fila}>
            {vendedores.map((m) => (
              <Pressable key={m.id} onPress={() => navigation.navigate('Vendedor', { id: m.id })}>
                <Tarjeta style={e.vendedor}>
                  <View style={e.filaChica}>
                    <Iniciales nombre={m.nombre} />
                    <Texto v="fuerte" lineas={2} style={{ flex: 1 }}>
                      {m.nombre}
                    </Texto>
                  </View>
                  <Texto v="gris">{cuantos(m.id)} productos</Texto>
                  {m.deLaCasa ? <Insignia texto="Precios para todos" /> : m.relacion === 'APROBADA' ? <Insignia texto="Eres cliente" /> : <Insignia texto="Verificado" color="gris" />}
                </Tarjeta>
              </Pressable>
            ))}
          </ScrollView>
        </Seccion>

        {ofertas.length > 0 && (
          <Seccion titulo="Ofertas por caja">
            {ofertas.map((p) => {
              const grande = p.escalas.find((x) => x.presentacion === 'CAJA' || x.presentacion === 'FARDO')!;
              return (
                <Pressable key={p.id} onPress={() => abrir(p)}>
                  <Tarjeta style={e.oferta}>
                    <Foto producto={p} alto={56} ancho={56} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Texto v="fuerte" lineas={1}>
                        {p.nombre}
                      </Texto>
                      <Texto v="gris">
                        {nombreCorto(p.mayorista.nombre)} · {grande.presentacion.toLowerCase()} de {grande.cantidad} u.
                      </Texto>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Texto v="precio">{bs((grande.precioUnitario?.centavos ?? 0) * grande.cantidad)}</Texto>
                      <Texto v="chico">{grande.precioUnitario?.texto} c/u</Texto>
                    </View>
                  </Tarjeta>
                </Pressable>
              );
            })}
          </Seccion>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AvisoSinSenal() {
  return (
    <View style={e.sinSenal} accessibilityRole="alert">
      <Icono nombre="cloud-offline-outline" tamano={16} color={COLOR.ambarTexto} />
      <Texto style={{ color: COLOR.ambarTexto, fontSize: 12.5, fontWeight: '600' }}>Sin conexión · usas tus datos guardados</Texto>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 18, paddingBottom: 32 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icono: { width: 46, height: 46, borderRadius: 14, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde, alignItems: 'center', justifyContent: 'center' },
  insigniaNum: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLOR.ambar, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: COLOR.superficie },
  num: { fontSize: 10.5, fontWeight: '800', color: '#2B1A00' },
  buscador: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 16, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde, paddingLeft: 12, ...SOMBRA },
  buscadorTexto: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: '100%' },
  camara: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  portada: { backgroundColor: COLOR.tinta, borderRadius: 22, padding: 20, gap: 8, overflow: 'hidden' },
  botonPortada: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#fff', marginTop: 6 },
  caja: { position: 'absolute', width: 56, height: 44, borderRadius: 8 },
  fila: { gap: 10, paddingRight: 16 },
  destacado: { width: 160, gap: 8, padding: 10 },
  pie: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, marginTop: 'auto' },
  vendedor: { width: 172, gap: 6, padding: 12 },
  filaChica: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oferta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 2 },
  sinSenal: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: COLOR.ambarSuave },
});
