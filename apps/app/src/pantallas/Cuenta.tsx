import { useEspacioBarra } from '../BarraInferior';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatoCelular } from '../acceso';
import { Aparecer, Tocable } from '../animacion';
import { Boton, Icono, Iniciales, Tarjeta, Texto } from '../componentes';
import { iconoDeEtiqueta } from '../direcciones';
import { useDirecciones } from '../direcciones-estado';
import { CambiarNegocio, useNegocio } from '../NegocioInicio';
import { Diagnostico } from '../ia';
import type { PantallaDePestana } from '../navegacion';
import { useSesion } from '../sesion';
import { COLOR } from '../tema';

const PANEL = process.env.EXPO_PUBLIC_PANEL_URL ?? 'http://localhost:5170/';

/** La cuenta del cliente: su nombre y celular, sus direcciones y salir. Si además vende, el enlace al Panel. */
export function Cuenta({ navigation }: PantallaDePestana<'Cuenta'>) {
  const espacio = useEspacioBarra();
  const { usuario, salir } = useSesion();
  const { lista, elegida, borrar } = useDirecciones();
  const { negocio } = useNegocio();
  const [diagnostico, setDiagnostico] = useState(false);
  if (!usuario) return null;
  if (diagnostico) return <Diagnostico alCerrar={() => setDiagnostico(false)} />;
  const vende = usuario.roles.includes('mayorista') || usuario.roles.includes('admin');
  const nombre = usuario.nombre || usuario.orgNombre;

  const preguntarBorrar = (id: string, calle: string) =>
    Alert.alert('¿Borrar esta dirección?', calle, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void borrar(id) },
    ]);

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={[e.contenido, { paddingBottom: espacio }]}>
        <Aparecer>
          <LinearGradient colors={[COLOR.bosque, COLOR.bosqueMedio]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={e.perfil}>
            <Iniciales nombre={nombre} tamano={60} />
            <View style={{ flex: 1, gap: 2 }}>
              <Texto v="t2" style={{ color: '#fff' }}>
                {nombre}
              </Texto>
              {!!usuario.telefono && (
                <View style={e.filaChica}>
                  <Icono nombre="logo-whatsapp" tamano={15} color="rgba(255,255,255,0.85)" />
                  <Texto style={{ color: 'rgba(255,255,255,0.85)' }}>+591 {formatoCelular(usuario.telefono)}</Texto>
                </View>
              )}
            </View>
          </LinearGradient>
        </Aparecer>

        <Aparecer orden={1} style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Texto v="t3">Para qué compras</Texto>
            <Texto v="gris">El Inicio te muestra primero lo que usas.</Texto>
          </View>
          <CambiarNegocio />
        </Aparecer>

        <Aparecer orden={1}>
          <Tarjeta style={{ gap: 8 }}>
            <Texto v="t3">IA en tu teléfono</Texto>
            <Texto v="gris">Arma tu compra con tus palabras, una receta o una foto, sin internet.</Texto>
            <Boton tipo="secundario" texto="Elegir el modelo" icono="hardware-chip-outline" alTocar={() => navigation.navigate('IaLocal')} />
          </Tarjeta>
        </Aparecer>

        <Aparecer orden={1} style={{ gap: 10 }}>
          <View style={e.cabeza}>
            <Texto v="t3">Mis direcciones</Texto>
            <Tocable onPress={() => navigation.navigate('NuevaDireccion')} style={e.agregar} accessibilityRole="button">
              <Icono nombre="add" tamano={18} color={COLOR.verde} />
              <Texto v="fuerte" style={{ color: COLOR.verde }}>
                Agregar
              </Texto>
            </Tocable>
          </View>
          {lista.map((d) => (
            <Tarjeta key={d.id} style={e.direccion}>
              <View style={[e.icono, d.id === elegida?.id && { backgroundColor: COLOR.verde }]}>
                <Icono nombre={iconoDeEtiqueta(d.etiqueta)} tamano={20} color={d.id === elegida?.id ? '#fff' : COLOR.texto2} />
              </View>
              <View style={{ flex: 1 }}>
                <Texto v="fuerte">{d.etiqueta}</Texto>
                <Texto v="gris" lineas={2}>
                  {[d.calle, d.zona, d.referencia].filter(Boolean).join(' · ')}
                </Texto>
              </View>
              {lista.length > 1 && (
                <Tocable onPress={() => preguntarBorrar(d.id, d.calle)} accessibilityRole="button" accessibilityLabel={`Borrar ${d.etiqueta}`} style={{ padding: 6 }}>
                  <Icono nombre="trash-outline" tamano={20} color={COLOR.texto3} />
                </Tocable>
              )}
            </Tarjeta>
          ))}
        </Aparecer>

        {usuario.roles.includes('tienda') && negocio?.tipo !== 'hogar' && (
          <Aparecer orden={2}>
            <Tarjeta style={{ gap: 8 }}>
              <Texto v="t3">¿Vendes por internet?</Texto>
              <Texto v="gris">Conecta tu tienda en línea y sus pedidos llegan solos a Abasto.</Texto>
              <Boton tipo="secundario" texto="Conectar mi tienda en línea" icono="link-outline" alTocar={() => navigation.navigate('ConectarTienda')} />
            </Tarjeta>
          </Aparecer>
        )}

        {vende && (
          <Aparecer orden={2}>
            <Tarjeta style={{ gap: 8 }}>
              <Texto v="t3">También vendes en Abasto</Texto>
              <Texto v="gris">Tus pedidos, compras, productos y clientes se gestionan en el Panel web, con esta misma cuenta.</Texto>
              <Boton tipo="secundario" texto="Abrir el Panel" icono="open-outline" alTocar={() => void Linking.openURL(PANEL)} />
              <Boton tipo="chico" texto="Probar la IA del teléfono" alTocar={() => setDiagnostico(true)} />
            </Tarjeta>
          </Aparecer>
        )}

        <Aparecer orden={3}>
          <Boton tipo="secundario" texto="Cerrar sesión" icono="log-out-outline" alTocar={() => void salir()} />
        </Aparecer>
        <Texto v="chico" style={{ textAlign: 'center', color: COLOR.texto3 }}>
          Abasto · Santa Cruz, Bolivia
        </Texto>
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 18, paddingBottom: 32 },
  perfil: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24 },
  filaChica: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agregar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: COLOR.verdeSuave },
  direccion: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  icono: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLOR.tenue, alignItems: 'center', justifyContent: 'center' },
});
