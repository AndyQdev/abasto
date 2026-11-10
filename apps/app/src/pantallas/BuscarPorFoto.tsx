import { opcionesDeCompra, type Producto } from '@abasto/comercio';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Foto, SinPrecio, Tarjeta, Texto } from '../componentes';
import { BotonAgregar } from '../BotonAgregar';
import { useEstado } from '../estado';
import { BuscarConFoto } from '../ia';
import { useNegocio } from '../NegocioInicio';
import type { PantallaDePila } from '../navegacion';
import { COLOR } from '../tema';

/**
 * Buscar con una foto: la abren la cámara del Inicio y la de Buscar (10/11, una sola pantalla).
 * Arriba se elige qué reconocer (producto, comida o receta) y si se usa la IA del teléfono; todo pasa en el
 * teléfono y anda sin señal sobre el catálogo guardado. La lógica está en `src/ia` (BuscarConFoto).
 */
export function BuscarPorFoto({ navigation }: PantallaDePila<'BuscarPorFoto'>) {
  const { catalogo, agregarRapido, agregarAlCarrito, avisar } = useEstado();
  const { negocio } = useNegocio();
  const paraQue = negocio ? [negocio.tipo, negocio.subtipo].filter(Boolean).join(' · ') : null;

  function mostrarProducto(p: Producto) {
    const opciones = opcionesDeCompra(p);
    return (
      <Pressable onPress={() => navigation.navigate('Producto', { id: p.id })}>
        <Tarjeta style={e.resultado}>
          <Foto producto={p} alto={60} ancho={60} />
          <View style={{ flex: 1, gap: 3 }}>
            <Texto v="fuerte">{p.nombre}</Texto>
            <Texto v="gris">{p.mayorista.nombre}</Texto>
            {opciones.length ? (
              <Texto v="precio" style={{ fontSize: 13 }}>
                {opciones[opciones.length - 1].precioUnitario} c/u por {opciones[opciones.length - 1].nombre.toLowerCase()}
              </Texto>
            ) : (
              <SinPrecio />
            )}
          </View>
          <BotonAgregar producto={p} alAgregar={agregarRapido} oscuro={false} />
        </Tarjeta>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={e.pantalla} edges={['bottom']}>
      <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
        <BuscarConFoto
          productos={catalogo.productos}
          negocio={paraQue}
          mostrarProducto={mostrarProducto}
          alBuscarEscribiendo={() => navigation.navigate('Buscar')}
          alElegirModelo={() => navigation.navigate('IaLocal')}
          alAgregar={(items) => {
            items.forEach((item) => agregarAlCarrito(item));
            avisar(`Agregaste ${items.length} ${items.length === 1 ? 'producto' : 'productos'} al carrito`);
            navigation.navigate('Pestanas', { screen: 'Carrito' });
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 14, paddingBottom: 32 },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
});
