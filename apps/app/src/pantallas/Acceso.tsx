import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { entrarConCodigo, ErrorDeAcceso, esCelular, formatoCelular, pedirCodigo, soloDigitos, type EnvioDeCodigo } from '../acceso';
import { Aparecer, Tocable, useSacudida, vibrar } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { ILUSTRACION } from '../ilustraciones';
import { useSesion } from '../sesion';
import { COLOR } from '../tema';

type Paso = 'telefono' | 'codigo' | 'nombre';

/**
 * Entrar como en PedidosYa: celular → código → (solo la primera vez) nombre. Nada de correo ni contraseña.
 * Después la sesión queda guardada y la app no vuelve a pedir nada de esto.
 */
export function Acceso() {
  const { iniciar } = useSesion();
  const [paso, setPaso] = useState<Paso>('telefono');
  const [telefono, setTelefono] = useState('');
  const [envio, setEnvio] = useState<EnvioDeCodigo | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const [x, sacudir] = useSacudida();

  // Cuenta regresiva para reenviar el código
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function mandarCodigo() {
    setError(null);
    setOcupado(true);
    try {
      const r = await pedirCodigo(telefono);
      setEnvio(r);
      setCodigo('');
      setEspera(30);
      setPaso('codigo');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mandar el código');
      vibrar.error();
    } finally {
      setOcupado(false);
    }
  }

  async function entrar(conCodigo: string, conNombre?: string) {
    setError(null);
    setOcupado(true);
    try {
      const r = await entrarConCodigo(telefono, conCodigo, conNombre);
      vibrar.exito();
      await iniciar(r.tokens);
    } catch (e) {
      setOcupado(false);
      if (e instanceof ErrorDeAcceso && e.codigo === 'NECESITA_NOMBRE') {
        setPaso('nombre');
        return;
      }
      vibrar.error();
      sacudir();
      setError(e instanceof Error ? e.message : 'No se pudo entrar');
      if (e instanceof ErrorDeAcceso && e.codigo === 'CODIGO_INCORRECTO') setCodigo('');
    }
  }

  const atras = () => {
    setError(null);
    setPaso(paso === 'nombre' ? 'codigo' : 'telefono');
  };

  return (
    <SafeAreaView style={e.pantalla} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled" bounces={false}>
          {paso !== 'telefono' && (
            <Tocable onPress={atras} style={e.atras} accessibilityRole="button" accessibilityLabel="Atrás">
              <Icono nombre="arrow-back" tamano={22} />
            </Tocable>
          )}

          {paso === 'telefono' && (
            <>
              <Aparecer>
                <LinearGradient colors={['#DDEFE5', COLOR.fondo]} style={e.ilustracionGrande}>
                  <Image source={ILUSTRACION.bienvenida} style={e.imagen} contentFit="cover" transition={300} accessibilityIgnoresInvertColors />
                </LinearGradient>
              </Aparecer>
              <Aparecer orden={1} style={e.textos}>
                <Texto v="titulo" style={e.titulo}>
                  Todo para tu tienda, al por mayor
                </Texto>
                <Texto v="gris" style={e.subtitulo}>
                  Pide hoy y te lo llevamos. Entra solo con tu celular.
                </Texto>
              </Aparecer>
              <Aparecer orden={2} style={{ gap: 14 }}>
                <View style={e.campoTelefono}>
                  <View style={e.prefijo}>
                    <Texto style={{ fontSize: 18 }}>🇧🇴</Texto>
                    <Texto v="fuerte">+591</Texto>
                  </View>
                  <TextInput
                    accessibilityLabel="Tu número de celular"
                    value={formatoCelular(telefono)}
                    onChangeText={(t) => setTelefono(soloDigitos(t))}
                    placeholder="712 34 567"
                    placeholderTextColor={COLOR.texto3}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    maxLength={10}
                    style={e.entradaTelefono}
                    returnKeyType="done"
                    onSubmitEditing={() => esCelular(telefono) && void mandarCodigo()}
                  />
                  {esCelular(telefono) && <Icono nombre="checkmark-circle" color={COLOR.verde} tamano={22} />}
                </View>
                {error && <Falla texto={error} />}
                <Boton texto="Continuar" icono="arrow-forward" deshabilitado={!esCelular(telefono)} cargando={ocupado} alTocar={() => void mandarCodigo()} />
                <View style={e.nota}>
                  <Icono nombre="logo-whatsapp" tamano={16} color={COLOR.verde} />
                  <Texto v="chico">Te mandamos un código por WhatsApp. Sin contraseñas.</Texto>
                </View>
              </Aparecer>
            </>
          )}

          {paso === 'codigo' && envio && (
            <>
              <Aparecer>
                <Image source={ILUSTRACION.codigo} style={e.ilustracionChica} contentFit="contain" transition={300} />
              </Aparecer>
              <Aparecer orden={1} style={e.textos}>
                <Texto v="titulo" style={e.titulo}>
                  Escribe el código
                </Texto>
                <Texto v="gris" style={e.subtitulo}>
                  Te lo mandamos por WhatsApp al +591 {formatoCelular(telefono)}
                </Texto>
              </Aparecer>
              <Aparecer orden={2} style={{ gap: 16 }}>
                <Animated.View style={{ transform: [{ translateX: x }] }}>
                  <CajitasDeCodigo
                    valor={codigo}
                    alCambiar={(v) => {
                      setCodigo(v);
                      setError(null);
                      if (v.length === 6) void entrar(v);
                    }}
                    deshabilitado={ocupado}
                  />
                </Animated.View>
                {envio.codigoDePrueba && (
                  <Tocable onPress={() => void entrar(envio.codigoDePrueba!)} style={e.prueba} accessibilityRole="button">
                    <Icono nombre="flask-outline" color={COLOR.ambarTexto} />
                    <View style={{ flex: 1 }}>
                      <Texto v="chico" style={{ color: COLOR.ambarTexto }}>
                        Modo prueba (todavía sin WhatsApp)
                      </Texto>
                      <Texto v="fuerte" style={{ color: COLOR.ambarTexto, letterSpacing: 4, fontSize: 18 }}>
                        {envio.codigoDePrueba}
                      </Texto>
                    </View>
                    <Texto v="fuerte" style={{ color: COLOR.ambarTexto }}>
                      Usar
                    </Texto>
                  </Tocable>
                )}
                {error && <Falla texto={error} />}
                {ocupado && <Boton texto="Verificando…" cargando alTocar={() => undefined} />}
                <Pressable disabled={espera > 0 || ocupado} onPress={() => void mandarCodigo()} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
                  <Texto v="fuerte" style={{ color: espera > 0 ? COLOR.texto3 : COLOR.verde }}>
                    {espera > 0 ? `Reenviar código en 0:${String(espera).padStart(2, '0')}` : 'Reenviar código'}
                  </Texto>
                </Pressable>
              </Aparecer>
            </>
          )}

          {paso === 'nombre' && (
            <>
              <Aparecer>
                <Image source={ILUSTRACION.bienvenida} style={e.ilustracionChica} contentFit="cover" transition={300} />
              </Aparecer>
              <Aparecer orden={1} style={e.textos}>
                <Texto v="titulo" style={e.titulo}>
                  ¡Bienvenido a Abasto!
                </Texto>
                <Texto v="gris" style={e.subtitulo}>
                  ¿Cómo te llamas? Así te saluda quien te lleva tu pedido.
                </Texto>
              </Aparecer>
              <Aparecer orden={2} style={{ gap: 14 }}>
                <View style={e.campo}>
                  <Icono nombre="person-outline" color={COLOR.texto3} />
                  <TextInput
                    accessibilityLabel="Tu nombre"
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder="Tu nombre"
                    placeholderTextColor={COLOR.texto3}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    autoFocus
                    style={e.entrada}
                    returnKeyType="go"
                    onSubmitEditing={() => nombre.trim().length > 1 && void entrar(codigo || envio?.codigoDePrueba || '', nombre)}
                  />
                </View>
                {error && <Falla texto={error} />}
                <Boton
                  texto="Empezar a comprar"
                  icono="bag-handle-outline"
                  deshabilitado={nombre.trim().length < 2}
                  cargando={ocupado}
                  alTocar={() => void entrar(codigo || envio?.codigoDePrueba || '', nombre)}
                />
              </Aparecer>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Seis cajitas: el teclado escribe en un campo invisible y las cajitas muestran cada dígito. */
function CajitasDeCodigo({ valor, alCambiar, deshabilitado }: { valor: string; alCambiar: (v: string) => void; deshabilitado: boolean }) {
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    const t = setTimeout(() => campo.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);
  return (
    <Pressable onPress={() => campo.current?.focus()} accessibilityLabel="Código de 6 dígitos" style={e.cajitas}>
      {Array.from({ length: 6 }, (_, i) => {
        const activa = i === valor.length && !deshabilitado;
        return (
          <View key={i} style={[e.cajita, valor[i] ? e.cajitaLlena : null, activa ? e.cajitaActiva : null]}>
            <Texto style={e.digito}>{valor[i] ?? ''}</Texto>
          </View>
        );
      })}
      <TextInput
        ref={campo}
        value={valor}
        onChangeText={(t) => alCambiar(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        editable={!deshabilitado}
        style={e.invisible}
        caretHidden
      />
    </Pressable>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { flexGrow: 1, padding: 22, gap: 18, justifyContent: 'flex-end' },
  atras: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLOR.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLOR.borde },
  ilustracionGrande: { borderRadius: 32, overflow: 'hidden', aspectRatio: 4 / 4.2 },
  imagen: { width: '100%', height: '100%' },
  ilustracionChica: { width: '78%', aspectRatio: 1, alignSelf: 'center', borderRadius: 28 },
  textos: { gap: 8 },
  titulo: { fontSize: 30, lineHeight: 36 },
  subtitulo: { fontSize: 16, lineHeight: 22 },
  campoTelefono: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLOR.superficie,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLOR.borde,
    paddingRight: 14,
    height: 62,
  },
  prefijo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: '100%', borderRightWidth: 1, borderRightColor: COLOR.borde },
  entradaTelefono: { flex: 1, fontSize: 21, fontWeight: '700', color: COLOR.texto, letterSpacing: 1 },
  nota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cajitas: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cajita: {
    flex: 1,
    height: 62,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLOR.borde,
    backgroundColor: COLOR.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajitaLlena: { borderColor: COLOR.verde, backgroundColor: COLOR.verdeSuave },
  cajitaActiva: { borderColor: COLOR.verde, borderWidth: 2.5 },
  digito: { fontSize: 26, fontWeight: '800', color: COLOR.texto },
  invisible: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  prueba: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: COLOR.ambarSuave },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLOR.superficie,
    borderWidth: 1.5,
    borderColor: COLOR.borde,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 60,
  },
  entrada: { flex: 1, fontSize: 18, color: COLOR.texto },
});
