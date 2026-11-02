import { NEGOCIOS, TIPOS_DE_NEGOCIO, type TipoDeNegocio } from '@abasto/comercio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Tocable } from '../animacion';
import { Boton, Icono, Texto } from '../componentes';
import { rubroCorto } from '../ilustraciones';
import { IMAGEN_DE_NEGOCIO, useNegocio } from '../NegocioInicio';
import { useSesion } from '../sesion';
import { COLOR, FUENTE, SOMBRA } from '../tema';

/**
 * Registro, paso del negocio (01/11): se pregunta una sola vez, después de entrar con el celular y antes de la
 * dirección. Con lo que elige, el Inicio le muestra primero sus rubros, sus secciones y lo que le sugerimos.
 * Se cambia después en Cuenta.
 */
export function Negocio() {
  const { elegir } = useNegocio();
  const { usuario } = useSesion();
  const [elegido, setElegido] = useState<TipoDeNegocio | null>(null);
  const nombre = usuario?.nombre?.split(' ')[0];

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#DDF4A0', '#EEF8D5', COLOR.fondo]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={[e.burbuja, { width: 240, height: 240, top: -70, right: -70 }]} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={e.contenido} bounces={false}>
          <Aparecer style={{ gap: 6 }}>
            <Texto style={e.paso}>{nombre ? `¡Hola, ${nombre}!` : '¡Ya casi!'}</Texto>
            <Texto style={e.pregunta}>¿Qué negocio tienes?</Texto>
            <Texto v="gris">Te mostramos primero lo que usas cada semana.</Texto>
          </Aparecer>

          {TIPOS_DE_NEGOCIO.map((t, i) => {
            const activo = t === elegido;
            const n = NEGOCIOS[t];
            return (
              <Aparecer key={t} orden={1 + i}>
                <Tocable
                  onPress={() => setElegido(t)}
                  style={[e.opcion, activo && e.opcionActiva]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  accessibilityLabel={`${n.nombre}. ${n.ejemplo}`}
                >
                  <View style={[e.fondoImagen, activo && { backgroundColor: COLOR.lima }]}>
                    <Image source={IMAGEN_DE_NEGOCIO[t]} style={e.imagen} contentFit="contain" accessibilityIgnoresInvertColors />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Texto style={e.nombre}>{n.nombre}</Texto>
                    <Texto v="chico" lineas={2}>
                      {n.ejemplo}
                    </Texto>
                    {activo && (
                      <Texto style={e.sugerimos} lineas={2}>
                        Te sugerimos: {n.rubros.slice(0, 4).map(rubroCorto).join(' · ')}
                      </Texto>
                    )}
                  </View>
                  <View style={[e.marca, activo && e.marcaActiva]}>{activo && <Icono nombre="checkmark" tamano={16} color={COLOR.lima} />}</View>
                </Tocable>
              </Aparecer>
            );
          })}
        </ScrollView>
        <View style={e.pie}>
          <Boton texto="Continuar" icono="arrow-forward" deshabilitado={!elegido} alTocar={() => elegido && elegir(elegido)} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const e = StyleSheet.create({
  contenido: { padding: 20, paddingTop: 28, gap: 14 },
  burbuja: { position: 'absolute', borderRadius: 999, backgroundColor: COLOR.lima, opacity: 0.35 },
  paso: { fontFamily: FUENTE.fuerte, fontSize: 15, color: COLOR.bosqueMedio },
  pregunta: { fontFamily: FUENTE.negra, fontSize: 28, lineHeight: 32, color: COLOR.texto, letterSpacing: -0.8 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 24, backgroundColor: COLOR.superficie, borderWidth: 2, borderColor: 'transparent', ...SOMBRA },
  opcionActiva: { borderColor: COLOR.bosque },
  fondoImagen: { width: 92, height: 92, borderRadius: 20, backgroundColor: COLOR.limaSuave, alignItems: 'center', justifyContent: 'center' },
  // La ilustración sobresale un poco de su cuadro
  imagen: { width: 108, height: 108 },
  nombre: { fontFamily: FUENTE.negra, fontSize: 16.5, color: COLOR.texto, letterSpacing: -0.3 },
  sugerimos: { fontFamily: FUENTE.fuerte, fontSize: 12, color: COLOR.limaTexto, marginTop: 2 },
  marca: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLOR.borde, alignItems: 'center', justifyContent: 'center' },
  marcaActiva: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  pie: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
});
