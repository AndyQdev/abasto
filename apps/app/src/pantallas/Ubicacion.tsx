import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer, Esqueleto, Tocable, vibrar } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { ETIQUETAS, etiquetaSugerida, iconoDeEtiqueta, type Etiqueta } from '../direcciones';
import { calleDe, ErrorDeUbicacion, ubicacionActual, ultimaUbicacion, useDirecciones } from '../direcciones-estado';
import { ILUSTRACION } from '../ilustraciones';
import { CENTRO_SANTA_CRUZ, ElegirPunto, MapaChico, type Punto } from '../Mapa';
import { COLOR, SOMBRA } from '../tema';

type Paso = 'inicio' | 'mapa' | 'datos';

/**
 * «¿Dónde te lo llevamos?», como en PedidosYa: la primera vez que entra y al tocar «Nueva dirección».
 * 1. Ubicación actual (GPS) o elegir en el mapa.
 * 2. El mapa con el pin fijo en el centro: se mueve el mapa hasta la puerta y se lee el nombre de la calle.
 * 3. Los últimos detalles (referencia y cómo guardarla).
 */
export function Ubicacion({ alTerminar, alCerrar }: { alTerminar?: () => void; alCerrar?: () => void }) {
  const { lista, guardar } = useDirecciones();
  const [paso, setPaso] = useState<Paso>('inicio');
  const [punto, setPunto] = useState<Punto | null>(null);
  const [inicial, setInicial] = useState<Punto>(CENTRO_SANTA_CRUZ);
  const [irA, setIrA] = useState<Punto | null>(null);
  const [calle, setCalle] = useState('');
  const [zona, setZona] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [etiqueta, setEtiqueta] = useState<Etiqueta>(etiquetaSugerida(lista));
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consulta = useRef(0);
  const sinMapa = Platform.OS === 'web';

  /** El nombre de la calle bajo el pin; si el mapa se movió otra vez mientras tanto, se descarta */
  async function leerCalle(p: Punto) {
    const n = ++consulta.current;
    setPunto(p);
    setLeyendo(true);
    const t = await calleDe(p);
    if (n !== consulta.current) return;
    setCalle(t.calle === 'Mi ubicación' ? '' : t.calle);
    setZona(t.zona);
    setLeyendo(false);
  }

  async function usarUbicacion() {
    setError(null);
    setBuscando(true);
    try {
      const p = await ubicacionActual();
      setInicial({ latitud: p.latitud, longitud: p.longitud });
      setPunto({ latitud: p.latitud, longitud: p.longitud });
      setCalle(p.calle === 'Mi ubicación' ? '' : p.calle);
      setZona(p.zona);
      vibrar.exito();
      setPaso(sinMapa ? 'datos' : 'mapa');
    } catch (e) {
      setError(e instanceof ErrorDeUbicacion ? e.message : 'No pudimos encontrar tu ubicación');
    } finally {
      setBuscando(false);
    }
  }

  async function elegirEnMapa() {
    setError(null);
    if (sinMapa) return setPaso('datos');
    const aqui = await ultimaUbicacion();
    const p = aqui ?? CENTRO_SANTA_CRUZ;
    setInicial(p);
    setPaso('mapa');
    void leerCalle(p);
  }

  async function volverAMiUbicacion() {
    setBuscando(true);
    try {
      const p = await ubicacionActual();
      setIrA({ latitud: p.latitud, longitud: p.longitud });
    } catch (e) {
      setError(e instanceof ErrorDeUbicacion ? e.message : 'No pudimos encontrar tu ubicación');
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

  if (paso === 'mapa') {
    return (
      <PasoMapa
        inicial={inicial}
        irA={irA}
        calle={calle}
        zona={zona}
        leyendo={leyendo}
        buscando={buscando}
        error={error}
        alMover={(p) => void leerCalle(p)}
        alEmpezar={() => setLeyendo(true)}
        alMiUbicacion={() => void volverAMiUbicacion()}
        alVolver={() => setPaso('inicio')}
        alConfirmar={() => {
          vibrar.exito();
          setPaso('datos');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={e.pantalla} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={[e.contenido, paso === 'datos' && { justifyContent: 'flex-start' }]} keyboardShouldPersistTaps="handled">
          {(alCerrar || paso === 'datos') && (
            <Tocable
              onPress={paso === 'datos' ? () => setPaso(punto && !sinMapa ? 'mapa' : 'inicio') : alCerrar}
              style={e.cerrar}
              exterior={paso === 'inicio' && e.cerrarArriba}
              accessibilityRole="button"
              accessibilityLabel={paso === 'datos' ? 'Volver' : 'Cerrar'}
            >
              <Icono nombre={paso === 'datos' ? 'arrow-back' : 'close'} tamano={22} />
            </Tocable>
          )}

          {paso === 'inicio' && (
            <>
              <Aparecer>
                <Image source={ILUSTRACION.ubicacion} style={e.ilustracion} contentFit="contain" transition={300} />
              </Aparecer>
              <Aparecer orden={1} style={{ gap: 8 }}>
                <Texto v="titulo" style={e.titulo}>
                  ¿Dónde te lo llevamos?
                </Texto>
                <Texto v="gris" style={{ fontSize: 16, lineHeight: 22 }}>
                  Usamos tu ubicación solo para llevarte tus pedidos. La puedes cambiar cuando quieras.
                </Texto>
              </Aparecer>
              <Aparecer orden={2} style={{ gap: 12 }}>
                {error && <Falla texto={error} />}
                <Boton texto={buscando ? 'Buscando dónde estás…' : 'Usar mi ubicación actual'} icono="navigate" cargando={buscando} alTocar={() => void usarUbicacion()} />
                <Boton texto="Elegir en el mapa" tipo="secundario" icono="map-outline" alTocar={() => void elegirEnMapa()} />
              </Aparecer>
            </>
          )}

          {paso === 'datos' && (
            <Aparecer style={{ gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Texto v="titulo" style={e.titulo}>
                  Últimos detalles
                </Texto>
                <Texto v="gris" style={{ fontSize: 15, lineHeight: 21 }}>
                  Así el repartidor llega directo a tu puerta.
                </Texto>
              </View>

              {punto && !sinMapa && (
                <Tocable hundir={0.98} onPress={() => setPaso('mapa')} accessibilityRole="button" accessibilityLabel="Cambiar el punto en el mapa">
                  <MapaChico punto={punto} alto={150} />
                  <View style={e.cambiarPunto}>
                    <Icono nombre="move-outline" tamano={16} color={COLOR.bosque} />
                    <Texto v="fuerte" style={{ fontSize: 13 }}>
                      Ajustar en el mapa
                    </Texto>
                  </View>
                </Tocable>
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

              <Boton texto="Guardar dirección" tipo="oscuro" icono="checkmark" deshabilitado={calle.trim().length < 3} alTocar={() => void confirmar()} />
            </Aparecer>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** El mapa a pantalla completa con el pin al centro y la calle abajo. */
function PasoMapa({
  inicial,
  irA,
  calle,
  zona,
  leyendo,
  buscando,
  error,
  alMover,
  alEmpezar,
  alMiUbicacion,
  alVolver,
  alConfirmar,
}: {
  inicial: Punto;
  irA: Punto | null;
  calle: string;
  zona: string;
  leyendo: boolean;
  buscando: boolean;
  error: string | null;
  alMover: (p: Punto) => void;
  alEmpezar: () => void;
  alMiUbicacion: () => void;
  alVolver: () => void;
  alConfirmar: () => void;
}) {
  const borde = useSafeAreaInsets();
  const [pista, setPista] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setPista(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.tenue }}>
      <ElegirPunto
        inicial={inicial}
        irA={irA}
        alMover={alMover}
        alEmpezar={() => {
          setPista(false);
          alEmpezar();
        }}
      />

      <View style={[e.arriba, { top: borde.top + 10 }]} pointerEvents="box-none">
        <Tocable onPress={alVolver} style={e.redondo} accessibilityRole="button" accessibilityLabel="Volver">
          <Icono nombre="arrow-back" tamano={22} />
        </Tocable>
        {pista && (
          <View style={e.pista}>
            <Texto v="fuerte" style={{ color: '#fff', fontSize: 13 }}>
              Mueve el mapa hasta tu puerta
            </Texto>
          </View>
        )}
      </View>

      <View style={[e.abajo, { paddingBottom: borde.bottom + 16 }]}>
        <Tocable onPress={alMiUbicacion} style={[e.redondo, e.miUbicacion]} accessibilityRole="button" accessibilityLabel="Ir a mi ubicación">
          <Icono nombre={buscando ? 'hourglass-outline' : 'locate'} tamano={22} color={COLOR.bosque} />
        </Tocable>
        {error && <Falla texto={error} />}
        <Texto v="chico" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Entregar en
        </Texto>
        {leyendo ? (
          <View style={{ gap: 8 }}>
            <Esqueleto alto={22} ancho="70%" />
            <Esqueleto alto={14} ancho="45%" />
          </View>
        ) : (
          <View style={{ gap: 2 }}>
            <Texto v="t2" lineas={2}>
              {calle || 'Punto en el mapa'}
            </Texto>
            <Texto v="gris">{calle ? zona || 'Santa Cruz de la Sierra' : 'Escribe la calle en el siguiente paso'}</Texto>
          </View>
        )}
        <Boton texto="Confirmar ubicación" icono="checkmark" deshabilitado={leyendo} alTocar={alConfirmar} />
      </View>
    </View>
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
  // En el primer paso el contenido va abajo: la X queda arriba, donde se busca
  cerrarArriba: { position: 'absolute', top: 22, left: 22, zIndex: 2 },
  ilustracion: { width: '100%', aspectRatio: 1, borderRadius: 32 },
  titulo: { fontSize: 30, lineHeight: 36 },
  cambiarPunto: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLOR.lima,
  },
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
  arriba: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center', ...SOMBRA },
  pista: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: 'rgba(24,45,37,0.88)', justifyContent: 'center' },
  abajo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLOR.superficie,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 10,
    ...SOMBRA,
    elevation: 12,
  },
  miUbicacion: { position: 'absolute', right: 16, top: -62 },
});
