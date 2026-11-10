import type { ItemDeCarrito, Producto } from '@abasto/comercio';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Boton, Icono, Tarjeta, Texto } from '../../componentes';
import { COLOR } from '../../tema';
import { proponerCompra, type Propuesta } from '../entender/asistente';
import { useIaLocal } from '../local/estado';
import { PropuestaDeCompra } from './PropuestaDeCompra';
import { reconocerFoto } from '../perezoso';

const EJEMPLOS = [
  'Necesito 3 cajas de aceite, 2 fardos de arroz y 5 docenas de leche',
  'Quiero hacer 300 salteñas para el sábado',
  'Una torta para 20 personas',
];

/**
 * El asistente de compra: escribe, pega una receta o saca una foto, y te arma el carrito con productos de Abasto.
 * Lo que no estaba claro se muestra como supuesto; lo que no tenemos se dice. Nada se agrega sin que lo confirmes.
 */
export function AsistenteDeCompra({
  productos,
  negocio,
  alAgregar,
}: {
  productos: Producto[];
  /** Para qué compra (hogar, tienda, productor y qué hace): ayuda a entender */
  negocio?: string | null;
  alAgregar: (items: ItemDeCarrito[]) => void;
}) {
  const ia = useIaLocal();
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null);
  const [propuestas, setPropuestas] = useState(0);

  // El modelo tarda en cargar: se empieza apenas se abre la pantalla, mientras la persona escribe
  useEffect(() => {
    void ia.interprete();
  }, [ia.interprete]);

  async function elegirFoto(desde: 'camara' | 'galeria') {
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    if (desde === 'camara' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
    const r = desde === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (!r.canceled && r.assets[0]) setFoto(r.assets[0].uri);
  }

  async function entender(eleccion: { platoElegido?: string; recetaElegida?: string } = {}) {
    setPensando(true);
    try {
      const interprete = await ia.interprete();
      setPropuesta(
        await proponerCompra({ texto, fotoUri: foto }, productos, {
          interprete,
          reconocerFoto,
          contexto: { negocio },
          // Al elegir otra forma de preparar el mismo plato se queda el plato ya reconocido
          platoElegido: eleccion.platoElegido ?? (eleccion.recetaElegida && propuesta?.lectura?.tipo === 'plato' ? propuesta.lectura.plato : null),
          recetaElegida: eleccion.recetaElegida ?? null,
        }),
      );
      setPropuestas((n) => n + 1);
    } finally {
      setPensando(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Tarjeta>
        <Texto v="t3">¿Qué necesitas comprar, abastecer o preparar?</Texto>
        <TextInput
          style={estilos.entrada}
          multiline
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe tu lista, pega una receta o di qué quieres hacer"
          placeholderTextColor={COLOR.texto3}
          accessibilityLabel="Lo que necesitas"
        />
        <View style={estilos.fila}>
          <Boton tipo="secundario" texto="Cámara" icono="camera-outline" alTocar={() => void elegirFoto('camara')} />
          <Boton tipo="secundario" texto="Galería" icono="images-outline" alTocar={() => void elegirFoto('galeria')} />
        </View>
        {foto && (
          <View style={estilos.fila}>
            <Image source={{ uri: foto }} style={estilos.miniatura} accessibilityLabel="Tu foto" />
            <Pressable onPress={() => setFoto(null)} accessibilityRole="button" accessibilityLabel="Quitar la foto">
              <Icono nombre="close-circle" color={COLOR.texto3} />
            </Pressable>
          </View>
        )}
        <Boton
          texto={ia.cargando ? 'Preparando la IA…' : 'Armar mi compra'}
          icono="sparkles-outline"
          cargando={pensando}
          deshabilitado={!texto.trim() && !foto}
          alTocar={() => void entender()}
        />
        <Texto v="chico" style={{ marginTop: 6 }}>
          {ia.activo ? `Entiende ${ia.activo.nombre}, dentro de tu teléfono.` : 'Funciona sin internet. Con el modelo de tu teléfono entiende mejor (Cuenta › IA en tu teléfono).'}
        </Texto>
        {!texto && !foto && (
          <View style={{ gap: 6, marginTop: 8 }}>
            {EJEMPLOS.map((e) => (
              <Pressable key={e} onPress={() => setTexto(e)} accessibilityRole="button">
                <Texto v="chico" style={estilos.ejemplo}>«{e}»</Texto>
              </Pressable>
            ))}
          </View>
        )}
      </Tarjeta>

      {propuesta && (
        <PropuestaDeCompra
          key={propuestas}
          propuesta={propuesta}
          nombreDelModelo={ia.activo?.nombre}
          alElegirPlato={(codigo) => void entender({ platoElegido: codigo })}
          alElegirReceta={(id) => void entender({ recetaElegida: id })}
          alAgregar={alAgregar}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  entrada: {
    minHeight: 96,
    marginVertical: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.borde,
    backgroundColor: COLOR.tenue,
    color: COLOR.texto,
    textAlignVertical: 'top',
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  miniatura: { width: 64, height: 64, borderRadius: 10 },
  ejemplo: { color: COLOR.texto2, textDecorationLine: 'underline' },
});
