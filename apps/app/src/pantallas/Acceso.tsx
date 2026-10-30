import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { entrarConCodigo, ErrorDeAcceso, esCelular, formatoCelular, pedirCodigo, soloDigitos, type EnvioDeCodigo } from '../acceso';
import { Aparecer, Flotar, Tocable, useSacudida, vibrar } from '../animacion';
import { Boton, Falla, Icono, Logo, Texto } from '../componentes';
import { ILUSTRACION } from '../ilustraciones';
import { useSesion } from '../sesion';
import { COLOR, FUENTE, SOMBRA } from '../tema';

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

  const heroe = paso === 'codigo' ? ILUSTRACION.codigo : ILUSTRACION.bienvenida;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={[COLOR.menta, '#93E8D6', COLOR.mentaClara]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={e.arriba}>
              {paso !== 'telefono' && (
                <Tocable onPress={atras} style={e.atras} exterior={e.atrasLugar} accessibilityRole="button" accessibilityLabel="Atrás">
                  <Icono nombre="arrow-back" tamano={22} color={COLOR.verde} />
                </Tocable>
              )}
              <Aparecer desde={-10}>
                <Flotar alto={8}>
                  <Image source={heroe} style={paso === 'telefono' ? e.heroe : e.heroeChico} contentFit="contain" transition={300} accessibilityIgnoresInvertColors />
                </Flotar>
              </Aparecer>
              {paso === 'telefono' && (
                <Aparecer orden={1} style={{ alignItems: 'center', gap: 6 }}>
                  <Logo tamano={40} />
                  <Texto style={e.lema}>Tu mayorista, siempre más cerca.</Texto>
                </Aparecer>
              )}
            </View>

            <Aparecer orden={2} desde={60}>
              <View style={e.tarjeta}>
                {paso === 'telefono' && (
                  <>
                    <View style={{ gap: 4 }}>
                      <Texto v="t2">Ingresa tu número de celular</Texto>
                      <Texto v="gris">Te enviaremos un código por WhatsApp.</Texto>
                    </View>
                    <View style={[e.campoTelefono, esCelular(telefono) && { borderColor: COLOR.menta }]}>
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
                      {esCelular(telefono) && <Icono nombre="checkmark-circle" color={COLOR.menta} tamano={24} />}
                    </View>
                    {error && <Falla texto={error} />}
                    <Boton texto="Enviar código" icono="logo-whatsapp" deshabilitado={!esCelular(telefono)} cargando={ocupado} alTocar={() => void mandarCodigo()} />
                    <View style={e.nota}>
                      <Icono nombre="lock-closed" tamano={13} color={COLOR.texto3} />
                      <Texto v="chico">Es rápido, seguro y gratis. Sin contraseñas.</Texto>
                    </View>
                  </>
                )}

                {paso === 'codigo' && envio && (
                  <>
                    <View style={{ gap: 4 }}>
                      <Texto v="t2">Escribe el código</Texto>
                      <Texto v="gris">Te lo mandamos por WhatsApp al +591 {formatoCelular(telefono)}</Texto>
                    </View>
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
                        <View style={e.icoPrueba}>
                          <Icono nombre="flask" color={COLOR.verde} tamano={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Texto v="chico" style={{ color: COLOR.limaTexto }}>
                            Modo prueba · todavía sin WhatsApp
                          </Texto>
                          <Texto v="fuerte" style={{ color: COLOR.verde, letterSpacing: 5, fontSize: 20 }}>
                            {envio.codigoDePrueba}
                          </Texto>
                        </View>
                        <Texto v="fuerte" style={{ color: COLOR.verde }}>
                          Usar
                        </Texto>
                      </Tocable>
                    )}
                    {error && <Falla texto={error} />}
                    {ocupado && <Boton texto="Verificando…" cargando alTocar={() => undefined} />}
                    <Pressable disabled={espera > 0 || ocupado} onPress={() => void mandarCodigo()} accessibilityRole="button" style={{ alignSelf: 'center', padding: 6 }}>
                      <Texto v="fuerte" style={{ color: espera > 0 ? COLOR.texto3 : COLOR.verde }}>
                        {espera > 0 ? `Reenviar código en 0:${String(espera).padStart(2, '0')}` : 'Reenviar código'}
                      </Texto>
                    </Pressable>
                  </>
                )}

                {paso === 'nombre' && (
                  <>
                    <View style={{ gap: 4 }}>
                      <Texto v="t2">¡Bienvenido a ABASTO!</Texto>
                      <Texto v="gris">¿Cómo te llamas? Así te saluda quien te lleva tu pedido.</Texto>
                    </View>
                    <View style={e.campo}>
                      <Icono nombre="person" color={COLOR.menta} />
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
                      icono="bag-handle"
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
      </SafeAreaView>
    </View>
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
  arriba: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 20, gap: 4 },
  atrasLugar: { position: 'absolute', top: 8, left: 16, zIndex: 2 },
  atras: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  heroe: { width: 300, height: 300 },
  heroeChico: { width: 230, height: 230 },
  lema: { fontFamily: FUENTE.fuerte, fontSize: 17, color: COLOR.verde, textAlign: 'center' },
  tarjeta: {
    backgroundColor: COLOR.superficie,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: 24,
    paddingBottom: 30,
    gap: 16,
    ...SOMBRA,
    shadowOffset: { width: 0, height: -6 },
  },
  campoTelefono: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLOR.tenue,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLOR.borde,
    paddingRight: 14,
    height: 60,
  },
  prefijo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: '60%', borderRightWidth: 1.5, borderRightColor: COLOR.borde },
  entradaTelefono: { flex: 1, fontSize: 20, fontFamily: FUENTE.fuerte, color: COLOR.texto, letterSpacing: 1 },
  nota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cajitas: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cajita: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLOR.borde,
    backgroundColor: COLOR.tenue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajitaLlena: { borderColor: COLOR.menta, backgroundColor: COLOR.mentaClara },
  cajitaActiva: { borderColor: COLOR.verde, backgroundColor: COLOR.superficie },
  digito: { fontSize: 26, fontFamily: FUENTE.negra, color: COLOR.texto },
  invisible: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  prueba: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: COLOR.lima },
  icoPrueba: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLOR.tenue,
    borderWidth: 2,
    borderColor: COLOR.borde,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 58,
  },
  entrada: { flex: 1, fontSize: 17, fontFamily: FUENTE.semi, color: COLOR.texto },
});
