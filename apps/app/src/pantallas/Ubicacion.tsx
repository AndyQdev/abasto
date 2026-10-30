import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Tocable, vibrar } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { ETIQUETAS, etiquetaSugerida, iconoDeEtiqueta, type Etiqueta } from '../direcciones';
import { ErrorDeUbicacion, ubicacionActual, useDirecciones, type PuntoActual } from '../direcciones-estado';
import { ILUSTRACION } from '../ilustraciones';
import { COLOR } from '../tema';

/**
 * «¿Dónde te lo llevamos?»: la primera vez que entra (sin direcciones) y al tocar «Nueva dirección».
 * Toma la ubicación actual con el nombre de la calle; si no hay GPS o permiso, se escribe a mano.
 */
export function Ubicacion({ alTerminar, alCerrar }: { alTerminar?: () => void; alCerrar?: () => void }) {
  const { lista, guardar } = useDirecciones();
  const [punto, setPunto] = useState<PuntoActual | null>(null);
  const [aMano, setAMano] = useState(false);
  const [calle, setCalle] = useState('');
  const [zona, setZona] = useState('');
  const [referencia, setReferencia] = useState('');
  const [etiqueta, setEtiqueta] = useState<Etiqueta>(etiquetaSugerida(lista));
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function usarUbicacion() {
    setError(null);
    setBuscando(true);
    try {
      const p = await ubicacionActual();
      setPunto(p);
      setCalle(p.calle);
      setZona(p.zona);
      vibrar.exito();
    } catch (e) {
      setError(e instanceof ErrorDeUbicacion ? e.message : 'No pudimos encontrar tu ubicación');
      setAMano(true);
    } finally {
      setBuscando(false);
    }
  }

  async function confirmar() {
    await guardar({
      etiqueta,
      calle: calle.trim(),
      zona: zona.trim(),
      referencia: referencia.trim(),
      latitud: punto?.latitud ?? null,
      longitud: punto?.longitud ?? null,
    });
    vibrar.exito();
    alTerminar?.();
  }

  const mostrarFormulario = punto !== null || aMano;

  return (
    <SafeAreaView style={e.pantalla} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
          {alCerrar && (
            <Tocable onPress={alCerrar} style={e.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Icono nombre="close" tamano={22} />
            </Tocable>
          )}

          {!mostrarFormulario && (
            <Aparecer>
              <Image source={ILUSTRACION.ubicacion} style={e.ilustracion} contentFit="contain" transition={300} />
            </Aparecer>
          )}

          <Aparecer orden={1} style={{ gap: 8 }}>
            <Texto v="titulo" style={e.titulo}>
              {mostrarFormulario ? 'Confirma tu dirección' : '¿Dónde te lo llevamos?'}
            </Texto>
            <Texto v="gris" style={{ fontSize: 16, lineHeight: 22 }}>
              {mostrarFormulario
                ? 'Revisa que esté bien y dinos cómo encontrarte.'
                : 'Usamos tu ubicación solo para llevarte tus pedidos. La puedes cambiar cuando quieras.'}
            </Texto>
          </Aparecer>

          {!mostrarFormulario && (
            <Aparecer orden={2} style={{ gap: 12 }}>
              {error && <Falla texto={error} />}
              <Boton texto={buscando ? 'Buscando dónde estás…' : 'Usar mi ubicación actual'} icono="navigate" cargando={buscando} alTocar={() => void usarUbicacion()} />
              <Boton texto="Escribir mi dirección" tipo="secundario" icono="create-outline" alTocar={() => setAMano(true)} />
            </Aparecer>
          )}

          {mostrarFormulario && (
            <Aparecer orden={2} style={{ gap: 14 }}>
              {punto && (
                <View style={e.encontrada}>
                  <View style={e.pin}>
                    <Icono nombre="location" color="#fff" tamano={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Texto v="chico" style={{ color: COLOR.verdeTexto }}>
                      Estás aquí
                    </Texto>
                    <Texto v="fuerte" lineas={2}>
                      {punto.calle}
                    </Texto>
                    {!!punto.zona && <Texto v="gris">{punto.zona}</Texto>}
                  </View>
                </View>
              )}
              {error && aMano && !punto && <Falla texto={error} />}
              {!punto && (
                <Boton texto={buscando ? 'Buscando dónde estás…' : 'Usar mi ubicación actual'} tipo="secundario" icono="navigate" cargando={buscando} alTocar={() => void usarUbicacion()} />
              )}

              <Campo icono="map-outline" valor={calle} alCambiar={setCalle} texto="Calle y número" />
              <Campo icono="business-outline" valor={zona} alCambiar={setZona} texto="Zona o barrio" />
              <Campo icono="chatbubble-ellipses-outline" valor={referencia} alCambiar={setReferencia} texto="Referencia: casa verde, portón negro…" />

              <Texto v="fuerte">Guárdala como</Texto>
              <View style={e.etiquetas}>
                {ETIQUETAS.map((et) => {
                  const activa = et === etiqueta;
                  return (
                    <Tocable key={et} onPress={() => setEtiqueta(et)} style={[e.etiqueta, activa && e.etiquetaActiva]} accessibilityRole="button" accessibilityState={{ selected: activa }}>
                      <Icono nombre={activa ? iconoDeEtiqueta(et) : (`${iconoDeEtiqueta(et)}-outline` as const)} tamano={18} color={activa ? COLOR.verde : COLOR.texto2} />
                      <Texto v="fuerte" style={{ color: activa ? COLOR.verde : COLOR.texto2 }}>
                        {et}
                      </Texto>
                    </Tocable>
                  );
                })}
              </View>

              <Boton texto="Guardar dirección" icono="checkmark" deshabilitado={calle.trim().length < 3} alTocar={() => void confirmar()} />
            </Aparecer>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Campo({ icono, valor, alCambiar, texto }: { icono: 'map-outline' | 'business-outline' | 'chatbubble-ellipses-outline'; valor: string; alCambiar: (v: string) => void; texto: string }) {
  return (
    <View style={e.campo}>
      <Icono nombre={icono} color={COLOR.texto3} />
      <TextInput accessibilityLabel={texto} value={valor} onChangeText={alCambiar} placeholder={texto} placeholderTextColor={COLOR.texto3} style={e.entrada} />
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { flexGrow: 1, padding: 22, gap: 18, justifyContent: 'flex-end' },
  cerrar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLOR.borde },
  ilustracion: { width: '100%', aspectRatio: 1, borderRadius: 32 },
  titulo: { fontSize: 30, lineHeight: 36 },
  encontrada: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: COLOR.verdeSuave },
  pin: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLOR.verde, alignItems: 'center', justifyContent: 'center' },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLOR.superficie,
    borderWidth: 1.5,
    borderColor: COLOR.borde,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  entrada: { flex: 1, fontSize: 16, color: COLOR.texto, paddingVertical: 12 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLOR.superficie,
    borderWidth: 1.5,
    borderColor: COLOR.borde,
  },
  etiquetaActiva: { backgroundColor: COLOR.lima, borderColor: COLOR.verde },
});
