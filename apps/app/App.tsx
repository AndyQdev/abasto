import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Icono, Texto, type NombreDeIcono } from './src/componentes';
import { ProveedorDeEstado, useEstado } from './src/estado';
import type { Pestanas, Pila } from './src/navegacion';
import { BuscarPorFoto } from './src/pantallas/BuscarPorFoto';
import { Buscar } from './src/pantallas/Buscar';
import { Carrito } from './src/pantallas/Carrito';
import { Cuenta } from './src/pantallas/Cuenta';
import { Entrar } from './src/pantallas/Entrar';
import { Finalizar } from './src/pantallas/Finalizar';
import { Inicio } from './src/pantallas/Inicio';
import { Pedidos } from './src/pantallas/Pedidos';
import { Producto } from './src/pantallas/Producto';
import { Seguimiento } from './src/pantallas/Seguimiento';
import { Vendedor } from './src/pantallas/Vendedor';
import { ProveedorDeSesion, useSesion } from './src/sesion';
import { COLOR } from './src/tema';

/**
 * Abasto: la app de los que compran al por mayor (tiendas y personas). Android e iPhone.
 * Compran aquí; Abasto gestiona los pedidos desde el Panel web.
 */
const Tab = createBottomTabNavigator<Pestanas>();
const Stack = createNativeStackNavigator<Pila>();

const ICONOS: Record<keyof Pestanas, NombreDeIcono> = {
  Inicio: 'home-outline',
  Buscar: 'search-outline',
  Carrito: 'cart-outline',
  Pedidos: 'receipt-outline',
  Cuenta: 'person-outline',
};

const TEMA = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: COLOR.fondo, primary: COLOR.verde, card: COLOR.superficie, border: COLOR.borde } };

function PestanasDeAbajo() {
  const { carrito } = useEstado();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLOR.verde,
        tabBarInactiveTintColor: COLOR.texto3,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <Icono nombre={ICONOS[route.name]} color={color} tamano={22} />,
      })}
    >
      <Tab.Screen name="Inicio" component={Inicio} />
      <Tab.Screen name="Buscar" component={Buscar} />
      <Tab.Screen name="Carrito" component={Carrito} options={{ tabBarBadge: carrito.length || undefined, tabBarBadgeStyle: { backgroundColor: COLOR.ambar } }} />
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
  if (!usuario) return <Entrar />;
  return (
    <ProveedorDeEstado>
      <NavigationContainer theme={TEMA}>
        <Stack.Navigator screenOptions={{ headerTintColor: COLOR.texto, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false, headerStyle: { backgroundColor: COLOR.fondo } }}>
          <Stack.Screen name="Pestanas" component={PestanasDeAbajo} options={{ headerShown: false }} />
          <Stack.Screen name="Producto" component={Producto} options={{ headerShown: false }} />
          <Stack.Screen name="Vendedor" component={Vendedor} options={{ headerShown: false }} />
          <Stack.Screen name="Finalizar" component={Finalizar} options={{ title: 'Finalizar pedido' }} />
          <Stack.Screen name="Seguimiento" component={Seguimiento} options={{ title: 'Pedido' }} />
          <Stack.Screen name="BuscarPorFoto" component={BuscarPorFoto} options={{ title: 'Buscar con una foto' }} />
        </Stack.Navigator>
      </NavigationContainer>
      <Aviso />
    </ProveedorDeEstado>
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
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
