import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Iniciales, Insignia, Tarjeta, Texto } from '../componentes';
import { Diagnostico } from '../diagnostico';
import { useSesion } from '../sesion';
import { COLOR } from '../tema';

const PANEL = process.env.EXPO_PUBLIC_PANEL_URL ?? 'http://localhost:5170/';

/** La cuenta de la tienda. Si además vende, el Panel web es donde gestiona sus pedidos. */
export function Cuenta() {
  const { usuario, salir } = useSesion();
  const [diagnostico, setDiagnostico] = useState(false);
  if (!usuario) return null;
  if (diagnostico) return <Diagnostico alCerrar={() => setDiagnostico(false)} />;
  const vende = usuario.roles.includes('mayorista') || usuario.roles.includes('admin');

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={e.contenido}>
        <Texto v="t1">Cuenta</Texto>
        <Tarjeta style={e.fila}>
          <Iniciales nombre={usuario.orgNombre || usuario.nombre} tamano={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Texto v="t3">{usuario.orgNombre || usuario.nombre}</Texto>
            <Texto v="gris">{usuario.correo}</Texto>
            {usuario.roles.includes('tienda') && <Insignia texto="Tienda" />}
          </View>
        </Tarjeta>

        {vende && (
          <Tarjeta style={{ gap: 8 }}>
            <Texto v="t3">También vendes en Abasto</Texto>
            <Texto v="gris">Tus pedidos, compras, productos y clientes se gestionan en el Panel web, con esta misma cuenta.</Texto>
            <Boton tipo="secundario" texto="Abrir el Panel" icono="open-outline" alTocar={() => void Linking.openURL(PANEL)} />
            <Boton tipo="chico" texto="Probar la IA del teléfono" alTocar={() => setDiagnostico(true)} />
          </Tarjeta>
        )}

        <Boton tipo="secundario" texto="Cerrar sesión" icono="log-out-outline" alTocar={() => void salir()} />
        <Texto v="chico" style={{ textAlign: 'center', color: COLOR.texto3 }}>
          Abasto · Santa Cruz, Bolivia
        </Texto>
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
