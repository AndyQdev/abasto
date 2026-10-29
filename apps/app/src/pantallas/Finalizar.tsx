import { bs, cantidadConUnidad, nombreCorto, porMayorista, totalDe } from '@abasto/comercio';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { graphql } from '../api';
import { bandeja } from '../bandeja-pedidos';
import { Boton, Icono, Tarjeta, Texto } from '../componentes';
import { useEstado } from '../estado';
import type { PantallaDePila } from '../navegacion';
import { useSesion } from '../sesion';
import { COLOR } from '../tema';

type Metodo = 'QR' | 'CONTRA_ENTREGA' | 'CREDITO';
type Credito = Record<string, { disponible: { centavos: number; texto: string } } | null>;

const METODOS: { id: Metodo; titulo: string; detalle: string }[] = [
  { id: 'QR', titulo: 'Pago por QR', detalle: 'Pagas desde tu banco o billetera cuando reservamos tu pedido' },
  { id: 'CONTRA_ENTREGA', titulo: 'Pago contra entrega', detalle: 'Pagas en efectivo o QR cuando recibes el pedido' },
  { id: 'CREDITO', titulo: 'Crédito', detalle: 'Solo con los vendedores que te dieron crédito' },
];

/**
 * Finalizar no llama al servidor: deja un pedido por vendedor en la bandeja, cada uno con su clave.
 * Con señal la bandeja lo manda enseguida; sin señal, cuando vuelva.
 */
export function Finalizar({ navigation }: PantallaDePila<'Finalizar'>) {
  const { carrito, cambiarCarrito, enLinea } = useEstado();
  const { usuario } = useSesion();
  const grupos = porMayorista(carrito);
  const total = grupos.reduce((s, g) => s + g.totalEstimadoCentavos, 0);
  const [metodo, setMetodo] = useState<Metodo>('QR');
  const [credito, setCredito] = useState<Credito>({});
  const [enviando, setEnviando] = useState(false);

  // El crédito disponible con cada vendedor (Cobros), para avisar antes si no alcanza
  const vendedores = grupos.map((g) => g.mayoristaId).join(',');
  useEffect(() => {
    if (!enLinea || !vendedores || !usuario) return;
    const ids = vendedores.split(',');
    const parametros = ids.map((_, i) => `$m${i}: ID!`).join(', ');
    const campos = ids.map((_, i) => `c${i}: lineaDeCredito(tiendaId: $t, mayoristaId: $m${i}) { disponible { centavos texto } }`).join(' ');
    const variables = Object.fromEntries([['t', usuario.orgId], ...ids.map((id, i) => [`m${i}`, id])]);
    graphql<Record<string, Credito[string]>>(`query Credito($t: ID!, ${parametros}) { ${campos} }`, variables)
      .then((r) => setCredito(Object.fromEntries(ids.map((id, i) => [id, r[`c${i}`]]))))
      .catch(() => setCredito({}));
  }, [enLinea, vendedores, usuario]);

  const sinCupo = grupos.filter((g) => !credito[g.mayoristaId] || credito[g.mayoristaId]!.disponible.centavos < g.totalEstimadoCentavos);

  async function hacerPedido() {
    setEnviando(true);
    for (const g of grupos) {
      await bandeja.agregar('pedido.crear', {
        mayoristaId: g.mayoristaId,
        metodoPago: metodo,
        lineas: g.items.map((i) => ({ productoId: i.productoId, presentacion: i.presentacion, cantidad: i.cantidad })),
      });
    }
    cambiarCarrito([]);
    if (enLinea) void bandeja.sincronizar();
    setEnviando(false);
    navigation.navigate('Pestanas', { screen: 'Pedidos' });
  }

  return (
    <SafeAreaView style={e.pantalla} edges={['bottom']}>
      <ScrollView contentContainerStyle={e.contenido}>
        {!enLinea && (
          <View style={e.aviso}>
            <Texto style={{ color: COLOR.ambarTexto, fontWeight: '600' }}>No hay señal. Guardamos tu pedido y se envía solo cuando vuelva.</Texto>
          </View>
        )}

        <Tarjeta style={{ gap: 10 }}>
          <Texto v="t3">Resumen del pedido</Texto>
          {grupos.map((g) => (
            <View key={g.mayoristaId} style={e.grupo}>
              <View style={e.entre}>
                <Texto v="fuerte">{g.mayoristaNombre}</Texto>
                <Texto v="fuerte">{bs(g.totalEstimadoCentavos)}</Texto>
              </View>
              {g.items.map((i) => (
                <View key={`${i.productoId}-${i.presentacion}`} style={e.entre}>
                  <Texto v="gris" style={{ flex: 1 }}>
                    {i.nombre} · {cantidadConUnidad(i)}
                  </Texto>
                  <Texto v="gris">{bs(totalDe(i))}</Texto>
                </View>
              ))}
            </View>
          ))}
          <View style={e.entre}>
            <Texto v="fuerte">Total estimado</Texto>
            <Texto v="t1">{bs(total)}</Texto>
          </View>
        </Tarjeta>

        <View style={{ gap: 8 }}>
          <Texto v="t3">Cómo pagas</Texto>
          {METODOS.map((m) => {
            const activo = metodo === m.id;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo }}
                onPress={() => setMetodo(m.id)}
                style={[e.radio, activo && { borderColor: COLOR.verde, backgroundColor: COLOR.verdeSuave }]}
              >
                <View style={[e.punto, activo && { borderWidth: 6, borderColor: COLOR.verde }]} />
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte">{m.titulo}</Texto>
                  <Texto v="gris">{m.detalle}</Texto>
                </View>
                <Icono nombre={m.id === 'QR' ? 'qr-code-outline' : m.id === 'CREDITO' ? 'card-outline' : 'cash-outline'} color={COLOR.texto3} />
              </Pressable>
            );
          })}
          {metodo === 'CREDITO' && (
            <View style={[e.aviso, !sinCupo.length && { backgroundColor: COLOR.verdeSuave }]}>
              {grupos.map((g) => (
                <Texto key={g.mayoristaId} style={{ color: sinCupo.length ? COLOR.ambarTexto : COLOR.verdeTexto }}>
                  {nombreCorto(g.mayoristaNombre)}: {credito[g.mayoristaId] ? `${credito[g.mayoristaId]!.disponible.texto} disponible` : 'no tienes crédito con este vendedor'}
                </Texto>
              ))}
              {sinCupo.length > 0 && <Texto style={{ color: COLOR.ambarTexto }}>Si no alcanza, el pedido no se puede hacer a crédito. Mejor elige otra forma de pago.</Texto>}
            </View>
          )}
        </View>
      </ScrollView>
      <View style={e.barra}>
        <Boton
          texto={enLinea ? `Hacer ${grupos.length === 1 ? 'el pedido' : `los ${grupos.length} pedidos`}` : 'Guardar pedido · se enviará cuando vuelva la señal'}
          cargando={enviando}
          deshabilitado={!grupos.length}
          alTocar={() => void hacerPedido()}
        />
      </View>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 14 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grupo: { gap: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLOR.borde },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie },
  punto: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLOR.borde },
  aviso: { padding: 12, borderRadius: 16, backgroundColor: COLOR.ambarSuave, gap: 4 },
  barra: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLOR.borde },
});
