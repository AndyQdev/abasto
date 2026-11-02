import { useEspacioBarra } from '../BarraInferior';
import { ILUSTRACION } from '../ilustraciones';
import { estadoVisible, fechaHora, filtrarPedidos, MIS_COMPRAS, nombreCorto, porPagar, productos as cuantos, type FiltroDePedidos, type Pedido } from '@abasto/comercio';
import type { OperacionLocal } from '@abasto/bandeja';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { graphql } from '../api';
import { bandeja } from '../bandeja-pedidos';
import { Chip, colorDeClase, Falla, Insignia, Tarjeta, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import { guardado } from '../guardado';
import { unaALaVez, useAvisosDePedidos } from '../tiempo-real';
import type { PantallaDePestana } from '../navegacion';
import { COLOR } from '../tema';

const PESTANAS: [FiltroDePedidos, string][] = [
  ['todos', 'Todos'],
  ['en_curso', 'En curso'],
  ['entregados', 'Entregados'],
  ['cancelados', 'Cancelados'],
];

/**
 * Mis pedidos: los que ya llegaron y los que esperan señal en el teléfono.
 * Se actualiza en tiempo real (02/11): al entrar a la pestaña, al tirar hacia abajo y cuando Conecta avisa que un
 * pedido cambió (`useAvisosDePedidos`). Nada de preguntar cada pocos segundos, y la ruedita solo sale al tirar.
 */
export function Pedidos({ navigation }: PantallaDePestana<'Pedidos'>) {
  const espacio = useEspacioBarra();
  const { enLinea, catalogo } = useEstado();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [enTelefono, setEnTelefono] = useState<OperacionLocal[]>([]);
  const [filtro, setFiltro] = useState<FiltroDePedidos>('todos');
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    void guardado.leer<Pedido[]>('pedidos').then((p) => p && setPedidos(p));
    void bandeja.pendientes().then(setEnTelefono);
    return bandeja.alCambiar((ops) => setEnTelefono(ops.filter((o) => o.estado !== 'aplicada')));
  }, []);

  // En silencio: la lista se reemplaza sin ruedita ni salto (los avisos llegan solos)
  const traer = useMemo(
    () =>
      unaALaVez(async () => {
        if (!enLinea) return;
        try {
          const d = await graphql<{ misCompras: Pedido[] }>(MIS_COMPRAS);
          setPedidos(d.misCompras);
          void guardado.escribir('pedidos', d.misCompras);
          setError(null);
        } catch (e) {
          setError((e as Error).message);
        }
      }),
    [enLinea],
  );

  // Al entrar a la pestaña y cuando la bandeja manda un pedido que estaba sin señal
  useFocusEffect(
    useCallback(() => {
      void traer();
    }, [traer]),
  );
  useEffect(() => {
    void traer();
  }, [traer, enTelefono.length]);
  // Cuando cambia un pedido (o vuelve la conexión), se vuelve a pedir la lista
  useAvisosDePedidos(() => void traer(), () => void traer());

  const tirar = async () => {
    setRefrescando(true);
    await traer();
    setRefrescando(false);
  };

  const vendedor = (id: string) => catalogo.mayoristas.find((m) => m.id === id)?.nombre ?? id;
  const lista = filtrarPedidos(pedidos, filtro);

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <FlatList
        data={lista}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[e.contenido, { paddingBottom: espacio }]}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => void tirar()} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Texto v="t1">Mis pedidos</Texto>
            {enTelefono.length > 0 && (
              <Tarjeta style={{ gap: 8 }}>
                <Texto v="t3">En tu teléfono</Texto>
                {enTelefono.map((o) => (
                  <View key={o.clave} style={e.entre}>
                    <View style={{ flex: 1 }}>
                      <Texto>Pedido a {nombreCorto(vendedor(String(o.datos.mayoristaId)))}</Texto>
                      <Texto v="chico">Clave única {o.clave.slice(0, 8)}</Texto>
                    </View>
                    <Insignia texto={o.estado === 'pendiente' ? 'Se envía cuando vuelva la señal' : (o.error ?? o.estado)} color={o.estado === 'pendiente' ? 'ambar' : 'rojo'} />
                  </View>
                ))}
              </Tarjeta>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PESTANAS.map(([id, texto]) => (
                <Chip key={id} texto={texto} activo={filtro === id} alTocar={() => setFiltro(id)} />
              ))}
            </ScrollView>
            {error && <Falla texto={error} />}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<Vacio imagen={ILUSTRACION.vacioPedidos} titulo="Todavía no hay pedidos aquí" detalle="Cuando pidas, aquí ves en qué va cada uno." />}
        renderItem={({ item: p }) => {
          const estado = estadoVisible(p);
          return (
            <Pressable onPress={() => navigation.navigate('Seguimiento', { id: p.id })}>
              <Tarjeta style={{ gap: 6 }}>
                <View style={e.entre}>
                  <Texto v="fuerte">#{p.codigo}</Texto>
                  <Insignia texto={estado.texto} color={colorDeClase(estado.clase)} />
                </View>
                <Texto v="fuerte">{nombreCorto(p.mayorista.nombre ?? vendedor(p.mayorista.id))}</Texto>
                <Texto v="gris">
                  {cuantos(p.lineas.length)} · {p.total.texto} · {fechaHora(p.creadoEn)}
                </Texto>
                {porPagar(p) && <Insignia texto="Paga con QR para que lo preparen" color="ambar" />}
              </Tarjeta>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 12, paddingBottom: 32 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
