import { StatusBar } from 'expo-status-bar';
import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlmacenSQLite } from './src/almacen-sqlite';
import { BandejaCampo, enviarAConecta, type OperacionLocal, type ProductoCargado } from './src/bandeja';
import { Diagnostico } from './src/diagnostico';
import { enBolivianos } from './src/precio';
import { canjearCodigo, URLS, useLogin } from './src/sesion';

/**
 * Abasto Campo: de pie en el puesto, con una mano y sin señal. Controles de 52 px, pocos y grandes.
 * Hoy: formulario + bandeja. En F4 entra la cámara: TFLite reconoce el producto y ML Kit lee el precio del cartel
 * (src/precio.ts ya interpreta el texto que devuelve el OCR).
 */
const COLORES = { marca: '#1A7554', tinta: '#123027', fondo: '#EEF3F0', borde: '#D9E3DE', ambar: '#FCF1DA', ambarTexto: '#8F5B00' };

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const { descubrimiento, peticion, respuesta, pedir } = useLogin();
  const bandeja = useMemo(
    () => new BandejaCampo(new AlmacenSQLite(), enviarAConecta(URLS.conecta, async () => token ?? ''), () => Crypto.randomUUID()),
    [token],
  );
  const [porSubir, setPorSubir] = useState<OperacionLocal[]>([]);
  const [aviso, setAviso] = useState('');
  const [diagnostico, setDiagnostico] = useState(false);
  const [form, setForm] = useState({ nombre: '', rubro: 'Higiene y cuidado personal', unidades: '48', precio: '' });

  useEffect(() => {
    if (respuesta?.type === 'success' && descubrimiento && peticion?.codeVerifier) {
      canjearCodigo(respuesta.params.code, peticion.codeVerifier, descubrimiento).then(setToken).catch(() => setAviso('No se pudo iniciar sesión'));
    }
  }, [respuesta, descubrimiento, peticion]);

  const refrescar = () => bandeja.porSubir().then(setPorSubir);
  useEffect(() => {
    void refrescar();
  }, [bandeja]);

  async function guardar() {
    const centavos = Math.round(Number(form.precio.replace(',', '.')) * 100);
    if (!form.nombre || !centavos) return setAviso('Falta el nombre o el precio');
    const producto: ProductoCargado = {
      nombre: form.nombre,
      rubro: form.rubro,
      presentacion: 'CAJA',
      unidades: Number(form.unidades) || 1,
      precioUnitarioCentavos: centavos,
    };
    await bandeja.agregar(producto);
    setForm({ ...form, nombre: '', precio: '' });
    setAviso('Guardado en el teléfono');
    await refrescar();
  }

  async function subir() {
    const r = await bandeja.subir();
    setAviso(r.subidos ? `Subidos ${r.subidos}` : 'Sin señal: se queda en la bandeja');
    await refrescar();
  }

  if (diagnostico) return <Diagnostico alCerrar={() => setDiagnostico(false)} />;

  if (!token) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <Text style={estilos.titulo}>ABASTO CAMPO</Text>
        <Text style={estilos.texto}>Entra con la misma cuenta del Panel Mayorista.</Text>
        <Pressable style={estilos.boton} disabled={!peticion} onPress={() => void pedir()}>
          <Text style={estilos.botonTexto}>Entrar</Text>
        </Pressable>
        {aviso ? <Text style={estilos.texto}>{aviso}</Text> : null}
        <Pressable style={[estilos.boton, estilos.secundario]} onPress={() => setDiagnostico(true)}>
          <Text style={[estilos.botonTexto, { color: COLORES.tinta }]}>Diagnóstico TFLite / ML Kit</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        <Text style={estilos.titulo}>CARGAR PRODUCTO</Text>
        <TextInput style={estilos.entrada} placeholder="Nombre (ej. Shampoo 400 ml)" value={form.nombre} onChangeText={(nombre) => setForm({ ...form, nombre })} />
        <TextInput style={estilos.entrada} placeholder="Unidades por caja" keyboardType="number-pad" value={form.unidades} onChangeText={(unidades) => setForm({ ...form, unidades })} />
        <TextInput style={estilos.entrada} placeholder="Precio por unidad (Bs)" keyboardType="decimal-pad" value={form.precio} onChangeText={(precio) => setForm({ ...form, precio })} />
        <Pressable style={estilos.boton} onPress={() => void guardar()}>
          <Text style={estilos.botonTexto}>Guardar</Text>
        </Pressable>

        <View style={estilos.bandeja}>
          <Text style={estilos.subtitulo}>{porSubir.length} por subir</Text>
          {porSubir.map((o) => (
            <Text key={o.clave} style={estilos.texto}>
              {o.datos.nombre} · {o.datos.unidades} u. · {enBolivianos(o.datos.precioUnitarioCentavos)}
            </Text>
          ))}
          <Pressable style={[estilos.boton, estilos.secundario]} onPress={() => void subir()}>
            <Text style={[estilos.botonTexto, { color: COLORES.tinta }]}>Subir ahora</Text>
          </Pressable>
        </View>
        {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}
        <Pressable style={[estilos.boton, estilos.secundario]} onPress={() => setDiagnostico(true)}>
          <Text style={[estilos.botonTexto, { color: COLORES.tinta }]}>Diagnóstico TFLite / ML Kit</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLORES.fondo, padding: 16, gap: 12 },
  titulo: { fontSize: 28, fontWeight: '700', color: COLORES.tinta, letterSpacing: -1 },
  subtitulo: { fontSize: 18, fontWeight: '700', color: COLORES.tinta },
  texto: { fontSize: 15, color: '#334155' },
  entrada: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORES.borde, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 16 },
  boton: { height: 52, borderRadius: 16, backgroundColor: COLORES.marca, alignItems: 'center', justifyContent: 'center' },
  secundario: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORES.borde },
  botonTexto: { color: '#fff', fontSize: 17, fontWeight: '700' },
  bandeja: { backgroundColor: '#fff', borderRadius: 26, padding: 16, gap: 8, borderWidth: 1, borderColor: COLORES.borde },
  aviso: { backgroundColor: COLORES.ambar, color: COLORES.ambarTexto, padding: 12, borderRadius: 14, fontWeight: '600' },
});
