import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { useSesion } from '../sesion';
import { COLOR } from '../tema';

/** Primera pantalla: la misma cuenta de Abasto en el teléfono y en la web (Keycloak). */
export function Entrar() {
  const { entrar, error } = useSesion();
  return (
    <SafeAreaView style={e.fondo}>
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
        <View style={e.punto}>
          <Icono nombre="pricetags-outline" color={COLOR.verde} />
          <Texto style={e.textoPunto}>Precios por docena, caja o fardo</Texto>
        </View>
        <View style={e.punto}>
          <Icono nombre="camera-outline" color={COLOR.verde} />
          <Texto style={e.textoPunto}>Busca un producto con una foto</Texto>
        </View>
        <View style={e.punto}>
          <Icono nombre="cash-outline" color={COLOR.verde} />
          <Texto style={e.textoPunto}>Paga por QR o al recibir</Texto>
        </View>
        {error && <Falla texto={error} />}
        <Boton texto="Entrar" icono="log-in-outline" alTocar={() => void entrar()} />
      </View>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: COLOR.tinta },
  portada: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 28, gap: 12 },
  logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: COLOR.verde, alignItems: 'center', justifyContent: 'center' },
  lema: { color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 22 },
  abajo: { backgroundColor: COLOR.fondo, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 },
  punto: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textoPunto: { fontSize: 15, color: COLOR.texto2 },
});
