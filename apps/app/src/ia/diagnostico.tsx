import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { describirTensor, entradaNeutra } from './modelo';
import { enBolivianos, leerPrecio } from './precio';

const CARTEL = Image.resolveAssetSource(require('../../assets/cartel-precio.png'))?.uri ?? '';

const COLORES = { marca: '#1A7554', tinta: '#123027', fondo: '#EEF3F0', borde: '#D9E3DE', ambar: '#FCF1DA', ambarTexto: '#8F5B00' };

/**
 * Prueba de humo del teléfono: carga el TFLite de ejemplo y lee el cartel con ML Kit.
 * No entra a la app ni pide sesión; sirve para saber si las dos librerías nativas corren.
 */
export function Diagnostico({ alCerrar }: { alCerrar: () => void }) {
  const modelo = useTensorflowModel(require('../../assets/modelos/ejemplo.tflite'), []);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [resultadoModelo, setResultadoModelo] = useState('Toca «Probar TFLite».');
  const [textoOcr, setTextoOcr] = useState('Toca «Leer cartel de prueba».');
  const [precioOcr, setPrecioOcr] = useState('');

  async function probarModelo() {
    if (modelo.state !== 'loaded') return;
    setOcupado(true);
    setError('');
    try {
      const entradas = modelo.model.inputs.map(entradaNeutra);
      const inicio = Date.now();
      const salidas = await modelo.model.run(entradas);
      const ms = Date.now() - inicio;
      const primera = salidas[0] ? [...new Uint8Array(salidas[0]).slice(0, 3)] : [];
      setResultadoModelo(`OK · ${ms} ms · ${salidas.length} salida(s) · primeros valores: ${primera.join(', ') || '—'}`);
    } catch (e) {
      setError(`TFLite falló: ${mensaje(e)}`);
    } finally {
      setOcupado(false);
    }
  }

  async function leerCartel() {
    setOcupado(true);
    setError('');
    try {
      const resultado = await TextRecognition.recognize(CARTEL);
      setTextoOcr(resultado.text || '(sin texto)');
      const centavos = leerPrecio(resultado.text);
      setPrecioOcr(centavos === null ? 'No reconocí un precio' : enBolivianos(centavos));
    } catch (e) {
      setError(`ML Kit falló: ${mensaje(e)}`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <View style={estilos.pantalla}>
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        <Text style={estilos.titulo}>DIAGNÓSTICO</Text>
        <Text style={estilos.texto}>TFLite de ejemplo y ML Kit sobre una foto de cartel. No necesita sesión.</Text>

        <View style={estilos.tarjeta}>
          <Text style={estilos.subtitulo}>TFLite</Text>
          <Text style={estilos.texto}>{estadoDelModelo(modelo)}</Text>
          {modelo.state === 'loaded' ? (
            <>
              {modelo.model.inputs.map((t) => (
                <Text key={`in-${t.name}`} style={estilos.mono}>entrada · {describirTensor(t)}</Text>
              ))}
              {modelo.model.outputs.map((t) => (
                <Text key={`out-${t.name}`} style={estilos.mono}>salida · {describirTensor(t)}</Text>
              ))}
              <Text style={estilos.texto}>delegados: {modelo.model.delegates.join(', ') || 'cpu'}</Text>
            </>
          ) : null}
          <Pressable style={[estilos.boton, modelo.state !== 'loaded' || ocupado ? estilos.apagado : null]} disabled={modelo.state !== 'loaded' || ocupado} onPress={() => void probarModelo()}>
            <Text style={estilos.botonTexto}>Probar TFLite</Text>
          </Pressable>
          <Text style={estilos.resultado}>{resultadoModelo}</Text>
        </View>

        <View style={estilos.tarjeta}>
          <Text style={estilos.subtitulo}>ML Kit</Text>
          <Image source={{ uri: CARTEL }} style={estilos.cartel} resizeMode="contain" />
          <Pressable style={[estilos.boton, ocupado ? estilos.apagado : null]} disabled={ocupado} onPress={() => void leerCartel()}>
            <Text style={estilos.botonTexto}>Leer cartel de prueba</Text>
          </Pressable>
          <Text style={estilos.texto}>{textoOcr}</Text>
          {precioOcr ? <Text style={estilos.precio}>{precioOcr}</Text> : null}
        </View>

        {error ? <Text style={estilos.error}>{error}</Text> : null}
        <Pressable style={[estilos.boton, estilos.secundario]} onPress={alCerrar}>
          <Text style={[estilos.botonTexto, { color: COLORES.tinta }]}>Volver</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function estadoDelModelo(modelo: ReturnType<typeof useTensorflowModel>): string {
  if (modelo.state === 'loading') return 'Cargando el modelo…';
  if (modelo.state === 'error') return `No cargó: ${modelo.error.message}`;
  return 'Modelo cargado en el teléfono.';
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo, padding: 16 },
  titulo: { fontSize: 28, fontWeight: '700', color: COLORES.tinta, letterSpacing: -1 },
  subtitulo: { fontSize: 18, fontWeight: '700', color: COLORES.tinta },
  texto: { fontSize: 15, color: '#334155' },
  mono: { fontSize: 12, color: '#334155', fontFamily: 'monospace' },
  tarjeta: { backgroundColor: '#fff', borderRadius: 26, padding: 16, gap: 8, borderWidth: 1, borderColor: COLORES.borde },
  cartel: { width: '100%', height: 120, borderRadius: 14, backgroundColor: '#F8FAF9' },
  boton: { height: 52, borderRadius: 16, backgroundColor: COLORES.marca, alignItems: 'center', justifyContent: 'center' },
  secundario: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORES.borde },
  apagado: { opacity: 0.5 },
  botonTexto: { color: '#fff', fontSize: 17, fontWeight: '700' },
  resultado: { fontSize: 15, color: COLORES.tinta, fontWeight: '600' },
  precio: { fontSize: 24, fontWeight: '700', color: COLORES.marca },
  error: { backgroundColor: COLORES.ambar, color: COLORES.ambarTexto, padding: 12, borderRadius: 14, fontWeight: '600' },
});
