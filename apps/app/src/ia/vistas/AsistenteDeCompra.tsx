import { cantidadConUnidad, itemDeCarrito, type ItemDeCarrito, type Producto } from '@abasto/comercio';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Boton, Chip, Foto, Icono, Insignia, Tarjeta, Texto } from '../../componentes';
import { COLOR } from '../../tema';
import { proponerCompra, type Propuesta } from '../entender/asistente';
import type { LineaPropuesta } from '../entender/catalogar';
import { useIaLocal } from '../local/estado';
import { NOMBRES_DE_PLATOS } from '../entender/foto';
import { reconocerFoto } from '../reconocer';

const EJEMPLOS = [
  'Necesito 3 cajas de aceite, 2 fardos de arroz y 5 docenas de leche',
  'Quiero hacer 300 salteñas para el sábado',
  'Una torta para 20 personas',
];

const etiqueta = (l: LineaPropuesta) =>
  l.escala ? cantidadConUnidad({ cantidad: l.cantidad, presentacion: l.escala.presentacion, unidadesPorPresentacion: l.escala.cantidad }) : '';

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
  const [quitadas, setQuitadas] = useState<Set<number>>(new Set());

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
    setQuitadas(new Set());
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
    } finally {
      setPensando(false);
    }
  }

  const lineas = propuesta?.lineas.filter((l) => l.producto && l.escala) ?? [];
  const faltan = propuesta?.lineas.filter((l) => !l.producto || !l.escala) ?? [];
  const elegidas = lineas.filter((_, i) => !quitadas.has(i));

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
        <>
          {propuesta.mensaje && (
            <Tarjeta style={estilos.mensaje}>
              <View style={estilos.fila}>
                <Icono nombre="sparkles" color={COLOR.bosque} />
                <Texto v="fuerte" style={{ flex: 1 }}>{propuesta.mensaje}</Texto>
              </View>
              {propuesta.lectura?.tipo === 'plato' && propuesta.lectura.opciones.length > 0 && (
                <View style={estilos.opciones}>
                  {propuesta.lectura.opciones.map((o) => (
                    <Chip key={o.codigo} texto={`${NOMBRES_DE_PLATOS[o.codigo] ?? o.codigo} · ${Math.round(o.confianza * 100)} %`} alTocar={() => void entender({ platoElegido: o.codigo })} />
                  ))}
                </View>
              )}
              {propuesta.variantes.length > 1 && (
                <View style={estilos.opciones}>
                  {propuesta.variantes.map((r) => (
                    <Chip key={r.id} texto={r.nombre} activo={r.id === propuesta.receta?.id} alTocar={() => void entender({ recetaElegida: r.id })} />
                  ))}
                </View>
              )}
            </Tarjeta>
          )}

          {propuesta.supuestos.length > 0 && (
            <Tarjeta style={estilos.supuestos}>
              <Texto v="fuerte">Lo que supusimos</Texto>
              {propuesta.supuestos.map((s) => (
                <Texto key={s} v="chico">• {s}</Texto>
              ))}
            </Tarjeta>
          )}

          {lineas.map((l, i) => (
            <Tarjeta key={`${l.producto!.id}-${i}`} style={quitadas.has(i) ? { opacity: 0.45 } : undefined}>
              <View style={estilos.fila}>
                <Foto producto={l.producto!} alto={52} ancho={52} />
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte">{l.producto!.nombre}</Texto>
                  <Texto v="gris">{etiqueta(l)}</Texto>
                  {!!l.nota && <Texto v="chico">{l.nota}</Texto>}
                </View>
                {l.certeza === 'aproximada' && <Insignia texto="Revisa" color="ambar" />}
                <Pressable
                  onPress={() => setQuitadas((q) => new Set(q.has(i) ? [...q].filter((x) => x !== i) : [...q, i]))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !quitadas.has(i) }}
                  accessibilityLabel={`Llevar ${l.producto!.nombre}`}
                >
                  <Icono nombre={quitadas.has(i) ? 'square-outline' : 'checkbox'} color={COLOR.bosque} />
                </Pressable>
              </View>
            </Tarjeta>
          ))}

          {faltan.length > 0 && (
            <Tarjeta>
              <Texto v="fuerte">No lo tenemos todavía</Texto>
              {faltan.map((l) => (
                <Texto key={l.pedido.nombre} v="chico">• {l.nota}</Texto>
              ))}
            </Tarjeta>
          )}

          {elegidas.length > 0 ? (
            <Boton
              tipo="oscuro"
              texto={`Agregar ${elegidas.length} ${elegidas.length === 1 ? 'producto' : 'productos'} al carrito`}
              alTocar={() => alAgregar(elegidas.map((l) => itemDeCarrito(l.producto!, l.escala!, l.cantidad)))}
            />
          ) : (
            !propuesta.supuestos.length && <Texto v="gris">No encontramos productos para eso. Prueba con otras palabras.</Texto>
          )}
          <Texto v="chico">
            Entendió: {propuesta.origen === 'modelo' ? `la IA de tu teléfono (${ia.activo?.nombre ?? ''})` : propuesta.origen === 'foto' ? 'el reconocedor de fotos de Abasto' : 'las reglas'}
            {propuesta.respuestaMs !== null ? ` · ${(propuesta.respuestaMs / 1000).toFixed(1).replace('.', ',')} s` : ''}
          </Texto>
          {propuesta.falloDelModelo && <Texto v="chico" style={{ color: COLOR.rojoTexto }}>La IA no pudo responder: {propuesta.falloDelModelo}</Texto>}
        </>
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
  supuestos: { backgroundColor: COLOR.ambarSuave },
  mensaje: { backgroundColor: COLOR.limaSuave, gap: 8 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
