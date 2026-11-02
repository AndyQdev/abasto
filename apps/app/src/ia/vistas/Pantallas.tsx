import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEstado } from '../../estado';
import { useNegocio } from '../../NegocioInicio';
import type { PantallaDePila } from '../../navegacion';
import { COLOR } from '../../tema';
import { AjustesIaLocal } from './AjustesIaLocal';
import { AsistenteDeCompra } from './AsistenteDeCompra';

const contenido = { padding: 16, paddingBottom: 40 };

/** Pantalla del asistente de compra (Buscar › «Pídelo con tus palabras»). */
export function PantallaAsistente({ navigation }: PantallaDePila<'Asistente'>) {
  const { catalogo, agregarAlCarrito, avisar } = useEstado();
  const { negocio } = useNegocio();
  const paraQue = negocio ? [negocio.tipo, negocio.subtipo].filter(Boolean).join(' · ') : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.fondo }} edges={['bottom']}>
      <ScrollView contentContainerStyle={contenido} keyboardShouldPersistTaps="handled">
        <AsistenteDeCompra
          productos={catalogo.productos}
          negocio={paraQue}
          alAgregar={(items) => {
            items.forEach(agregarAlCarrito);
            avisar(`Agregaste ${items.length} ${items.length === 1 ? 'producto' : 'productos'} al carrito`);
            navigation.navigate('Pestanas', { screen: 'Carrito' });
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Cuenta › «IA en tu teléfono»: el modelo que le toca a este teléfono, bajarlo y elegirlo. */
export function PantallaIaLocal() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.fondo }} edges={['bottom']}>
      <ScrollView contentContainerStyle={contenido}>
        <AjustesIaLocal />
      </ScrollView>
    </SafeAreaView>
  );
}
