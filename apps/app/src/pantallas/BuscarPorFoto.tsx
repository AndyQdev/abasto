import { buscarPorTextoLeido, opcionesDeCompra, palabrasClave, type Producto } from '@abasto/comercio';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, BotonMas, Falla, Foto, Icono, SinPrecio, Tarjeta, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import { leerTexto } from '../leer-texto';
import type { PantallaDePila } from '../navegacion';
import { COLOR } from '../tema';

/**
 * Buscar con una foto: la tienda le saca foto al producto (o a su etiqueta) y la app encuentra
 * lo que más se parece en el catálogo. Todo pasa en el teléfono: anda sin señal sobre el catálogo guardado.
 */
export function BuscarPorFoto({ navigation }: PantallaDePila<'BuscarPorFoto'>) {
  const { catalogo, agregarRapido } = useEstado();
  const [foto, setFoto] = useState<string | null>(null);
  const [leido, setLeido] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Producto[] | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(desde: 'camara' | 'galeria') {
    setError(null);
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    if (desde === 'camara') {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) return setError('Abasto necesita la cámara para buscar con una foto. Actívala en los ajustes del teléfono.');
    }
    const r = desde === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (r.canceled || !r.assets[0]) return;
    const uri = r.assets[0].uri;
    setFoto(uri);
    setLeyendo(true);
    setResultados(null);
    try {
      const texto = await leerTexto(uri);
      setLeido(texto);
      setResultados(buscarPorTextoLeido(catalogo.productos, texto));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  }

  const claves = leido ? palabrasClave(leido) : [];

  return (
    <SafeAreaView style={e.pantalla} edges={['bottom']}>
      <ScrollView contentContainerStyle={e.contenido}>
        <View style={e.marco}>
          {foto ? (
            <Image source={{ uri: foto }} style={e.foto} accessibilityLabel="Tu foto" />
          ) : (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Icono nombre="scan-outline" tamano={56} color={COLOR.verde} />
              <Texto v="fuerte" style={{ textAlign: 'center' }}>
                Sácale una foto al producto o a su etiqueta
              </Texto>
              <Texto v="gris" style={{ textAlign: 'center' }}>
                El teléfono lee el nombre y te mostramos dónde comprarlo al por mayor.
              </Texto>
            </View>
          )}
        </View>
        <View style={e.botones}>
          <View style={{ flex: 1 }}>
            <Boton texto="Tomar foto" icono="camera-outline" alTocar={() => void elegir('camara')} cargando={leyendo} />
          </View>
          <View style={{ flex: 1 }}>
            <Boton tipo="secundario" texto="Galería" icono="images-outline" alTocar={() => void elegir('galeria')} />
          </View>
        </View>

        {error && <Falla texto={error} />}
        {leyendo && <Texto v="gris">Leyendo la foto en tu teléfono…</Texto>}
        {claves.length > 0 && (
          <Texto v="gris">
            Leímos: <Texto v="fuerte">{claves.join(', ')}</Texto>
          </Texto>
        )}

        {resultados && !resultados.length && (
          <Vacio titulo="No encontramos ese producto" detalle="Prueba con otra foto donde se lea bien el nombre, o búscalo escribiendo.">
            <Boton tipo="chico" texto="Buscar escribiendo" alTocar={() => navigation.navigate('Pestanas', { screen: 'Buscar' })} />
          </Vacio>
        )}

        {resultados?.map((p) => {
          const opciones = opcionesDeCompra(p);
          return (
            <Pressable key={p.id} onPress={() => navigation.navigate('Producto', { id: p.id })}>
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
                <BotonMas producto={p} alAgregar={agregarRapido} />
              </Tarjeta>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 14, paddingBottom: 32 },
  marco: { height: 260, borderRadius: 24, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde, alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' },
  foto: { width: '100%', height: '100%', borderRadius: 16 },
  botones: { flexDirection: 'row', gap: 10 },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
});
