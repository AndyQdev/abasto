import { TIPOS, TIPOS_DE_NEGOCIO, negocioCompleto, type NegocioElegido, type SubtipoProductor, type TipoDeNegocio } from '@abasto/comercio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Tocable } from '../animacion';
import { Boton, Icono, Texto } from '../componentes';
import { Chips, IMAGEN_DE_NEGOCIO, OPCIONES_DE_SUBTIPO, useNegocio } from '../NegocioInicio';
import { useSesion } from '../sesion';
import { COLOR, FUENTE, SOMBRA } from '../tema';

/**
 * Registro, paso del tipo de cliente (01/11, obligatorio): después de entrar con el celular y antes de la dirección.
 * Tres tarjetas grandes (Hogar, Tienda, Productor) con su ilustración 3D y lo que gana; el productor dice además
 * qué hace (salteñería, panadería o pensión). Con eso cambian el Inicio y, desde la Fase 2, su pestaña
 * («Mi casa», «Mi tienda», «Mi producción»). Se cambia después en Cuenta.
 */
export function Negocio() {
  const { elegir } = useNegocio();
  const { usuario } = useSesion();
  const [tipo, setTipo] = useState<TipoDeNegocio | null>(null);
  const [subtipo, setSubtipo] = useState<SubtipoProductor | null>(null);
  const nombre = usuario?.nombre?.split(' ')[0];
  const elegido: Partial<NegocioElegido> | null = tipo && (tipo === 'productor' ? { tipo, subtipo: subtipo ?? undefined } : { tipo });
  const listo = negocioCompleto(elegido);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#DDF4A0', '#EEF8D5', COLOR.fondo]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={[e.burbuja, { width: 240, height: 240, top: -70, right: -70 }]} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={e.contenido} bounces={false}>
          <Aparecer style={{ gap: 4 }}>
            <Texto style={e.saludo}>{nombre ? `¡Hola, ${nombre}!` : '¡Ya casi!'}</Texto>
            <Texto style={e.pregunta}>¿Para qué compras?</Texto>
            <Texto v="gris">Así te armamos la app a tu medida. Lo cambias cuando quieras.</Texto>
          </Aparecer>

          {TIPOS_DE_NEGOCIO.map((t, i) => {
            const activo = t === tipo;
            const c = TIPOS[t];
            return (
              <Aparecer key={t} orden={1 + i}>
                <Tocable
                  hundir={0.98}
                  onPress={() => setTipo(t)}
                  style={[e.opcion, activo && e.opcionActiva]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  accessibilityLabel={`${c.nombre}. ${c.gana}`}
                >
                  <View style={e.textos}>
                    <View style={e.filaNombre}>
                      <View style={[e.marca, activo && e.marcaActiva]}>{activo && <Icono nombre="checkmark" tamano={14} color={COLOR.lima} />}</View>
                      <Texto style={e.nombre} lineas={1}>
                        {c.nombre}
                      </Texto>
                    </View>
                    <Texto style={e.gana}>{c.gana}</Texto>
                    <Texto v="chico" lineas={1}>
                      {c.ejemplo}
                    </Texto>
                  </View>
                  {/* La ilustración sobresale por arriba de la tarjeta */}
                  <Image source={IMAGEN_DE_NEGOCIO[t]} style={e.imagen} contentFit="contain" accessibilityIgnoresInvertColors />
                </Tocable>
                {activo && t === 'productor' && (
                  <View style={e.subtipos}>
                    <Texto v="fuerte">¿Qué haces?</Texto>
                    <Chips opciones={OPCIONES_DE_SUBTIPO} elegido={subtipo} alElegir={setSubtipo} />
                  </View>
                )}
              </Aparecer>
            );
          })}
        </ScrollView>
        <View style={e.pie}>
          <Boton
            texto={tipo === 'productor' && !subtipo ? 'Elige qué haces' : 'Continuar'}
            icono="arrow-forward"
            deshabilitado={!listo}
            alTocar={() => listo && elegir(elegido)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const ALTO = 128;

const e = StyleSheet.create({
  contenido: { padding: 20, paddingTop: 24, gap: 14, paddingBottom: 24 },
  burbuja: { position: 'absolute', borderRadius: 999, backgroundColor: COLOR.lima, opacity: 0.35 },
  saludo: { fontFamily: FUENTE.fuerte, fontSize: 15, color: COLOR.bosqueMedio },
  pregunta: { fontFamily: FUENTE.negra, fontSize: 28, lineHeight: 32, color: COLOR.texto, letterSpacing: -0.8 },
  // Margen arriba para que la ilustración que sobresale no choque con la tarjeta de arriba
  opcion: { marginTop: 22, height: ALTO, borderRadius: 26, backgroundColor: COLOR.superficie, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', ...SOMBRA },
  opcionActiva: { borderColor: COLOR.bosque, backgroundColor: COLOR.limaSuave },
  textos: { width: '60%', paddingLeft: 16, gap: 4 },
  filaNombre: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { flex: 1, fontFamily: FUENTE.negra, fontSize: 18, color: COLOR.texto, letterSpacing: -0.4 },
  gana: { fontFamily: FUENTE.fuerte, fontSize: 13, lineHeight: 17, color: COLOR.bosqueMedio },
  marca: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLOR.borde, alignItems: 'center', justifyContent: 'center' },
  marcaActiva: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  imagen: { position: 'absolute', right: 4, bottom: 4, width: 138, height: ALTO + 18 },
  subtipos: { gap: 8, marginTop: 10, padding: 12, borderRadius: 20, backgroundColor: COLOR.superficie, ...SOMBRA },
  pie: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
});
