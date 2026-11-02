import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Texto } from './src/componentes';
import { ProveedorDeEstado, useEstado } from './src/estado';
import type { Pestanas, Pila } from './src/navegacion';
import { BarraInferior } from './src/BarraInferior';
import { ProveedorDeDirecciones, useDirecciones } from './src/direcciones-estado';
import { ProveedorDeInventario } from './src/inventario';
import { ProveedorDeNegocio, useNegocio } from './src/NegocioInicio';
import { Acceso } from './src/pantallas/Acceso';
import { BuscarPorFoto } from './src/pantallas/BuscarPorFoto';
import { Buscar } from './src/pantallas/Buscar';
import { Carrito } from './src/pantallas/Carrito';
import { Cuenta } from './src/pantallas/Cuenta';
import { Finalizar } from './src/pantallas/Finalizar';
import { Inicio } from './src/pantallas/Inicio';
import { MiNegocio } from './src/pantallas/MiNegocio';
import { Negocio } from './src/pantallas/Negocio';
import { Pedidos } from './src/pantallas/Pedidos';
import { Producto } from './src/pantallas/Producto';
import { Seguimiento } from './src/pantallas/Seguimiento';
import { Ubicacion } from './src/pantallas/Ubicacion';
import { Vendedor } from './src/pantallas/Vendedor';
import { ProveedorDeSesion, useSesion } from './src/sesion';
import { ProveedorDeVuelo } from './src/vuelo';
import { COLOR } from './src/tema';

/**
 * Abasto: la app de los que compran al por mayor (tiendas y personas). Android e iPhone.
 * Compran aquí; Abasto gestiona los pedidos desde el Panel web.
 */
const Tab = createBottomTabNavigator<Pestanas>();
const Stack = createNativeStackNavigator<Pila>();

const TEMA = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: COLOR.fondo, primary: COLOR.verde, card: COLOR.superficie, border: COLOR.borde } };

function PestanasDeAbajo() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <BarraInferior {...props} />}>
      <Tab.Screen name="Inicio" component={Inicio} />
      <Tab.Screen name="Carrito" component={Carrito} />
      <Tab.Screen name="MiNegocio" component={MiNegocio} />
      <Tab.Screen name="Pedidos" component={Pedidos} />
      <Tab.Screen name="Cuenta" component={Cuenta} />
    </Tab.Navigator>
  );
}

function Navegacion() {
  const { usuario, cargando } = useSesion();
  if (cargando) {
    return (
      <View style={e.centro}>
        <ActivityIndicator color={COLOR.verde} size="large" />
      </View>
    );
  }
  // Como PedidosYa: sin sesión, celular y código; con sesión, nunca más se pide
  if (!usuario) return <Acceso />;
  return (
    <ProveedorDeNegocio>
      <ConNegocio />
    </ProveedorDeNegocio>
  );
}

/** Registro (01/11): después del celular, obligatorio, para qué compra (hogar, tienda o productor). Después, la dirección. */
function ConNegocio() {
  const { negocio, leido } = useNegocio();
  if (!leido) return <View style={e.centro} />;
  if (!negocio) return <Negocio />;
  return (
    <ProveedorDeDirecciones>
      <ConDireccion />
    </ProveedorDeDirecciones>
  );
}

/** La primera vez, antes de comprar, se pide dónde llevarle el pedido. */
function ConDireccion() {
  const { cargando, lista } = useDirecciones();
  if (cargando) return <View style={e.centro} />;
  if (!lista.length) return <Ubicacion />;
  return (
    <ProveedorDeEstado>
      <ConInventario>
      <ProveedorDeVuelo>
      <NavigationContainer theme={TEMA}>
        <Stack.Navigator screenOptions={{ headerTintColor: COLOR.texto, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false, headerStyle: { backgroundColor: COLOR.fondo } }}>
          <Stack.Screen name="Pestanas" component={PestanasDeAbajo} options={{ headerShown: false }} />
          <Stack.Screen name="Producto" component={Producto} options={{ headerShown: false }} />
          <Stack.Screen name="Buscar" component={Buscar} options={{ headerShown: false, animation: 'fade_from_bottom' }} />
          <Stack.Screen name="Vendedor" component={Vendedor} options={{ headerShown: false }} />
          <Stack.Screen name="Finalizar" component={Finalizar} options={{ title: 'Finalizar pedido' }} />
          <Stack.Screen name="Seguimiento" component={Seguimiento} options={{ title: 'Pedido' }} />
          <Stack.Screen name="BuscarPorFoto" component={BuscarPorFoto} options={{ title: 'Buscar con una foto' }} />
          <Stack.Screen name="NuevaDireccion" options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}>
            {({ navigation }) => <Ubicacion alTerminar={() => navigation.goBack()} alCerrar={() => navigation.goBack()} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      <Aviso />
      </ProveedorDeVuelo>
      </ConInventario>
    </ProveedorDeEstado>
  );
}

/** El inventario de «Mi negocio» es de quien entró; avisa cuando entran compras nuevas */
function ConInventario({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const { avisar } = useEstado();
  return (
    <ProveedorDeInventario
      dueno={usuario?.id ?? 'sin-sesion'}
      alEntrar={(n) => avisar(n === 1 ? 'Entró 1 producto a tu inventario' : `Entraron ${n} productos a tu inventario`)}
    >
      {children}
    </ProveedorDeInventario>
  );
}

/** «Agregaste 1 docena de …»: aparece abajo un par de segundos */
function Aviso() {
  const { aviso } = useEstado();
  if (!aviso) return null;
  return (
    <View style={e.aviso} pointerEvents="none" accessibilityRole="alert">
      <Texto style={{ color: '#fff', fontWeight: '600' }}>{aviso}</Texto>
    </View>
  );
}

export default function App() {
  const [fuentes] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  if (!fuentes) return <View style={e.centro} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <ProveedorDeSesion>
        <Navegacion />
      </ProveedorDeSesion>
    </SafeAreaProvider>
  );
}

const e = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.fondo },
  aviso: { position: 'absolute', left: 16, right: 16, bottom: 96, padding: 14, borderRadius: 16, backgroundColor: COLOR.tinta },
});
