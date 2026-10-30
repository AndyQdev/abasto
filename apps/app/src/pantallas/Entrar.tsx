import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { useSesion } from '../sesion';
import { COLOR } from '../tema';

/** Primera pantalla: correo y contraseña dentro de la app, sin abrir el navegador. Es la misma cuenta del Panel. */
export function Entrar() {
  const { entrar } = useSesion();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campoClave = useRef<ComponentRef<typeof TextInput>>(null);

  async function alEntrar() {
    setError(null);
    setEntrando(true);
    try {
      await entrar(correo, clave);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar. Vuelve a intentar.');
      setEntrando(false);
    }
  }

  return (
    <SafeAreaView style={e.fondo} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={e.portada}>
            <View style={e.logo}>
              <Icono nombre="cube" tamano={34} color="#fff" />
            </View>
            <Texto v="titulo" style={{ color: '#fff', fontSize: 34 }}>
              Abasto
            </Texto>
            <Texto style={e.lema}>Compra al por mayor para tu tienda o tu casa. Pide hoy y te lo llevamos.</Texto>
          </View>

          <View style={e.abajo}>
            <Texto v="t2">Entra a tu cuenta</Texto>

            <View style={e.campo}>
              <Icono nombre="mail-outline" color={COLOR.texto3} />
              <TextInput
                accessibilityLabel="Correo"
                value={correo}
                onChangeText={setCorreo}
                placeholder="Correo"
                placeholderTextColor={COLOR.texto3}
                style={e.entrada}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => campoClave.current?.focus()}
                editable={!entrando}
              />
            </View>

            <View style={e.campo}>
              <Icono nombre="lock-closed-outline" color={COLOR.texto3} />
              <TextInput
                ref={campoClave}
                accessibilityLabel="Contraseña"
                value={clave}
                onChangeText={setClave}
                placeholder="Contraseña"
                placeholderTextColor={COLOR.texto3}
                style={e.entrada}
                secureTextEntry={!verClave}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void alEntrar()}
                editable={!entrando}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onPress={() => setVerClave((v) => !v)}
                hitSlop={10}
              >
                <Icono nombre={verClave ? 'eye-off-outline' : 'eye-outline'} color={COLOR.texto3} />
              </Pressable>
            </View>

            {error && <Falla texto={error} />}
            <Boton texto={entrando ? 'Entrando…' : 'Entrar'} icono="log-in-outline" cargando={entrando} alTocar={() => void alEntrar()} />

            <View style={e.puntos}>
              <View style={e.punto}>
                <Icono nombre="pricetags-outline" color={COLOR.verde} tamano={18} />
                <Texto style={e.textoPunto}>Precios por docena, caja o fardo</Texto>
              </View>
              <View style={e.punto}>
                <Icono nombre="camera-outline" color={COLOR.verde} tamano={18} />
                <Texto style={e.textoPunto}>Busca un producto con una foto</Texto>
              </View>
              <View style={e.punto}>
                <Icono nombre="cash-outline" color={COLOR.verde} tamano={18} />
                <Texto style={e.textoPunto}>Paga por QR o al recibir</Texto>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: COLOR.tinta },
  portada: { flex: 1, minHeight: 240, justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 28, gap: 12 },
  logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLOR.verde, alignItems: 'center', justifyContent: 'center' },
  lema: { color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 22 },
  abajo: { backgroundColor: COLOR.fondo, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, gap: 14 },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLOR.superficie,
    borderWidth: 1,
    borderColor: COLOR.borde,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  entrada: { flex: 1, fontSize: 16, color: COLOR.texto, paddingVertical: 12 },
  puntos: { gap: 10, marginTop: 6 },
  punto: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textoPunto: { fontSize: 14, color: COLOR.texto2 },
});
