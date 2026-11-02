import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { entrarConCodigo, ErrorDeAcceso, esCelular, formatoCelular, pedirCodigo, soloDigitos, type EnvioDeCodigo } from '../acceso';
import { Aparecer, Tocable, useSacudida, vibrar } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { ILUSTRACION } from '../ilustraciones';
import { useSesion } from '../sesion';
import { COLOR, FUENTE, SOMBRA } from '../tema';

type Paso = 'telefono' | 'codigo' | 'nombre';

/**
 * Entrar como en PedidosYa: celular → código → (solo la primera vez) nombre. Nada de correo ni contraseña.
 * Después la sesión queda guardada y la app no vuelve a pedir nada de esto.
 *
 * Diseño (02/11, referencias en contracts/onboarding/): cada paso tiene su escena 3D a sangre arriba
 * (`portada-bienvenida`, `portada-codigo`, `portada-nombre`) y una tarjeta blanca con las esquinas de arriba muy
 * redondeadas que se monta sobre la escena. La bienvenida es la referencia de Andrés tal cual (contracts/onboarding/
 * image1.png sin la barra de estado): trae el logo y el lema dentro de la imagen y se muestra entera.
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

  const { height } = useWindowDimensions();
  const arriba = useSafeAreaInsets().top;
  const abajo = useSafeAreaInsets().bottom;
  const portada = paso === 'telefono' ? ILUSTRACION.portadaBienvenida : paso === 'codigo' ? ILUSTRACION.portadaCodigo : ILUSTRACION.portadaNombre;
  const teclado = useTecladoAbierto();
  // La escena ocupa la mitad de arriba; con el teclado abierto se achica para que el formulario quede a la vista
  const altoPortada = Math.round(height * (teclado ? 0.22 : paso === 'telefono' ? 0.5 : paso === 'codigo' ? 0.52 : 0.62));
  const codigoListo = codigo.length === 6;

  return (
    <View style={e.pantalla}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
          {/* Bienvenida: la imagen entera (trae el logo y el lema); con el teclado abierto, solo una franja de arriba */}
          <View style={paso === 'telefono' && !teclado ? { aspectRatio: PROPORCION_BIENVENIDA } : { height: altoPortada }}>
            <Image
              source={portada}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="top"
              transition={300}
              accessibilityLabel={paso === 'telefono' ? 'ABASTO. Tu mayorista, siempre más cerca.' : undefined}
              accessibilityIgnoresInvertColors
            />
            {paso !== 'telefono' && (
              <Tocable onPress={atras} style={e.atras} exterior={[e.atrasLugar, { top: arriba + 10 }]} accessibilityRole="button" accessibilityLabel="Atrás">
                <Icono nombre="arrow-back" tamano={22} color={COLOR.bosque} />
              </Tocable>
            )}
          </View>

          <Aparecer orden={2} desde={60} style={{ flexGrow: 1 }}>
            <View style={[e.tarjeta, paso === 'telefono' && !teclado ? e.tarjetaBajoElLema : e.tarjetaMontada, { paddingBottom: 24 + abajo }]}>
              {paso === 'telefono' && (
                <>
                  <View style={{ gap: 4 }}>
                    <Texto style={e.titulo}>Ingresa tu número de celular</Texto>
                    <Texto v="gris">Te enviaremos un código por WhatsApp.</Texto>
                  </View>
                  <View style={[e.campoTelefono, esCelular(telefono) && { borderColor: COLOR.bosque, backgroundColor: COLOR.superficie }]}>
                    <View style={e.prefijo}>
                      <BanderaDeBolivia />
                      <Texto v="fuerte" style={{ fontSize: 17 }}>
                        +591
                      </Texto>
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
                    {esCelular(telefono) && <Icono nombre="checkmark-circle" color={COLOR.bosque} tamano={24} />}
                  </View>
                  {error && <Falla texto={error} />}
                  <Boton texto="Enviar código por WhatsApp" icono="logo-whatsapp" deshabilitado={!esCelular(telefono)} cargando={ocupado} alTocar={() => void mandarCodigo()} />
                  <View style={e.nota}>
                    <Icono nombre="lock-closed" tamano={13} color={COLOR.texto3} />
                    <Texto v="chico">Es rápido, seguro y gratis. Sin contraseñas.</Texto>
                  </View>
                </>
              )}

              {paso === 'codigo' && envio && (
                <>
                  <View style={{ gap: 4 }}>
                    <Texto style={e.titulo}>Escribe el código</Texto>
                    <Texto v="gris">Te lo mandamos por WhatsApp al +591 {formatoCelular(telefono)}</Texto>
                  </View>
                  <Animated.View style={{ transform: [{ translateX: x }] }}>
                    <CajitasDeCodigo
                      valor={codigo}
                      conError={!!error}
                      alCambiar={(v) => {
                        setCodigo(v);
                        setError(null);
                        if (v.length === 6) void entrar(v);
                      }}
                      deshabilitado={ocupado}
                    />
                  </Animated.View>
                  {envio.codigoDePrueba && (
                    <Tocable onPress={() => void entrar(envio.codigoDePrueba!)} style={e.prueba} accessibilityRole="button" accessibilityLabel={`Usar el código de prueba ${envio.codigoDePrueba}`}>
                      <View style={e.icoPrueba}>
                        <Icono nombre="flask" color={COLOR.bosque} tamano={20} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Texto v="chico" style={{ color: COLOR.limaTexto }}>
                          Modo prueba · todavía sin WhatsApp
                        </Texto>
                        <Texto style={e.codigoPrueba}>{envio.codigoDePrueba}</Texto>
                      </View>
                      <Texto v="fuerte" style={{ color: COLOR.bosque, fontSize: 16 }}>
                        Usar
                      </Texto>
                    </Tocable>
                  )}
                  {error && <Falla texto={error} />}
                  <Boton
                    tipo="oscuro"
                    texto={ocupado ? 'Verificando…' : 'Verificar'}
                    icono="shield-checkmark"
                    cargando={ocupado}
                    deshabilitado={!codigoListo}
                    alTocar={() => void entrar(codigo)}
                  />
                  <Pressable disabled={espera > 0 || ocupado} onPress={() => void mandarCodigo()} accessibilityRole="button" style={{ alignSelf: 'center', padding: 6 }}>
                    <Texto v="fuerte" style={{ color: espera > 0 ? COLOR.texto3 : COLOR.bosque }}>
                      {espera > 0 ? `Reenviar código en 0:${String(espera).padStart(2, '0')}` : 'Reenviar código'}
                    </Texto>
                  </Pressable>
                </>
              )}

              {paso === 'nombre' && (
                <>
                  <View style={{ gap: 4 }}>
                    <Texto style={e.titulo}>¡Bienvenido a ABASTO!</Texto>
                    <Texto v="gris">¿Cómo te llamas? Así te saluda quien te lleva tu pedido.</Texto>
                  </View>
                  <View style={[e.campo, nombre.trim().length > 1 && { borderColor: COLOR.bosque, backgroundColor: COLOR.superficie }]}>
                    <Icono nombre="person" color={COLOR.bosque} />
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
                    tipo="oscuro"
                    texto="Continuar"
                    icono="arrow-forward"
                    deshabilitado={nombre.trim().length < 2}
                    cargando={ocupado}
                    alTocar={() => void entrar(codigo || envio?.codigoDePrueba || '', nombre)}
                  />
                </>
              )}
            </View>
          </Aparecer>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Si el teclado está abierto (la escena se achica mientras tanto) */
function useTecladoAbierto() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setAbierto(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setAbierto(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return abierto;
}

/** La bandera de Bolivia dibujada (rojo, amarillo y verde): sin emojis, se ve igual en todos los teléfonos */
function BanderaDeBolivia() {
  return (
    <View style={e.bandera} accessibilityLabel="Bolivia">
      <View style={{ flex: 1, backgroundColor: '#D52B1E' }} />
      <View style={{ flex: 1, backgroundColor: '#F9E300' }} />
      <View style={{ flex: 1, backgroundColor: '#007934' }} />
    </View>
  );
}

/** Seis cajitas: el teclado escribe en un campo invisible y las cajitas muestran cada dígito. */
function CajitasDeCodigo({ valor, alCambiar, deshabilitado, conError }: { valor: string; alCambiar: (v: string) => void; deshabilitado: boolean; conError?: boolean }) {
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
          <View key={i} style={[e.cajita, valor[i] ? e.cajitaLlena : null, activa ? e.cajitaActiva : null, conError ? e.cajitaError : null]}>
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

/** El ancho sobre el alto de `portada-bienvenida` (832 × 1248): se muestra entera */
const PROPORCION_BIENVENIDA = 832 / 1248;

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  atrasLugar: { position: 'absolute', left: 16, zIndex: 2 },
  atras: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...SOMBRA, shadowOpacity: 0.16 },
  titulo: { fontFamily: FUENTE.negra, fontSize: 23, color: COLOR.texto, letterSpacing: -0.6 },
  tarjeta: {
    flexGrow: 1,
    backgroundColor: COLOR.superficie,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 16,
    ...SOMBRA,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -8 },
  },
  // La tarjeta se monta sobre el borde de abajo de la escena
  tarjetaMontada: { marginTop: -30 },
  // En la bienvenida el lema está al pie de la imagen: la tarjeta apenas la toca
  tarjetaBajoElLema: { marginTop: -8 },
  campoTelefono: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLOR.tenue,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLOR.borde,
    paddingRight: 14,
    height: 62,
  },
  prefijo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: '60%', borderRightWidth: 1.5, borderRightColor: COLOR.borde },
  bandera: { width: 26, height: 18, borderRadius: 4, overflow: 'hidden' },
  entradaTelefono: { flex: 1, fontSize: 21, fontFamily: FUENTE.fuerte, color: COLOR.texto, letterSpacing: 1 },
  nota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cajitas: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cajita: {
    flex: 1,
    height: 62,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLOR.borde,
    backgroundColor: COLOR.tenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajitaLlena: { borderColor: COLOR.lima, backgroundColor: COLOR.limaSuave },
  cajitaActiva: { borderColor: COLOR.bosque, backgroundColor: COLOR.superficie },
  cajitaError: { borderColor: COLOR.rojo, backgroundColor: COLOR.rojoSuave },
  digito: { fontSize: 28, fontFamily: FUENTE.negra, color: COLOR.texto },
  invisible: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  prueba: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: COLOR.lima },
  icoPrueba: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.65)', alignItems: 'center', justifyContent: 'center' },
  codigoPrueba: { fontFamily: FUENTE.negra, fontSize: 22, letterSpacing: 6, color: COLOR.bosque },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLOR.tenue,
    borderWidth: 2,
    borderColor: COLOR.borde,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 60,
  },
  entrada: { flex: 1, fontSize: 17, fontFamily: FUENTE.semi, color: COLOR.texto },
});
