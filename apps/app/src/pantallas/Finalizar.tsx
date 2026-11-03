import { bs, cantidadConUnidad, nombreCorto, porMayorista, totalDe } from '@abasto/comercio';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tocable, vibrar } from '../animacion';
import { graphql } from '../api';
import { bandeja } from '../bandeja-pedidos';
import { Boton, Foto, Icono, Tarjeta, Texto, type NombreDeIcono } from '../componentes';
import { iconoDeEtiqueta } from '../direcciones';
import { useDirecciones } from '../direcciones-estado';
import { useEstado } from '../estado';
import { HojaDeDirecciones } from '../HojaDeDirecciones';
import { MapaChico } from '../Mapa';
import type { PantallaDePila } from '../navegacion';
import { useSesion } from '../sesion';
import { COLOR } from '../tema';

type Metodo = 'QR' | 'CONTRA_ENTREGA' | 'CREDITO';
type Credito = Record<string, { disponible: { centavos: number; texto: string } } | null>;

const METODOS: { id: Metodo; titulo: string; detalle: string; icono: NombreDeIcono }[] = [
  { id: 'QR', titulo: 'Pago por QR', detalle: 'Desde tu banco o billetera, cuando reservamos tu pedido', icono: 'qr-code' },
  { id: 'CONTRA_ENTREGA', titulo: 'Contra entrega', detalle: 'En efectivo o QR cuando lo recibes', icono: 'cash' },
  { id: 'CREDITO', titulo: 'Crédito', detalle: 'Con los vendedores que te dieron crédito', icono: 'card' },
];

/**
 * Finalizar no llama al servidor: deja un pedido por vendedor en la bandeja, cada uno con su clave y la
 * dirección de entrega elegida. Con señal la bandeja lo manda enseguida; sin señal, cuando vuelva.
 */
export function Finalizar({ navigation }: PantallaDePila<'Finalizar'>) {
  const { carrito, cambiarCarrito, enLinea, catalogo } = useEstado();
  const delCatalogo = (id: string) => catalogo.productos.find((p) => p.id === id);
  const { usuario } = useSesion();
  const { elegida } = useDirecciones();
  const grupos = porMayorista(carrito);
  const total = grupos.reduce((s, g) => s + g.totalEstimadoCentavos, 0);
  const [metodo, setMetodo] = useState<Metodo>('QR');
  const [credito, setCredito] = useState<Credito>({});
  const [enviando, setEnviando] = useState(false);
  const [cambiarDireccion, setCambiarDireccion] = useState(false);

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
  const creditoNoAlcanza = metodo === 'CREDITO' && sinCupo.length > 0;

  async function hacerPedido() {
    if (!elegida) return;
    setEnviando(true);
    const entrega = {
      calle: elegida.calle,
      zona: elegida.zona,
      referencia: elegida.referencia,
      latitud: elegida.latitud,
      longitud: elegida.longitud,
    };
    const claves: string[] = [];
    for (const g of grupos) {
      const op = await bandeja.agregar('pedido.crear', {
        mayoristaId: g.mayoristaId,
        metodoPago: metodo,
        lineas: g.items.map((i) => ({ productoId: i.productoId, presentacion: i.presentacion, cantidad: i.cantidad })),
        entrega,
      });
      claves.push(op.clave);
    }
    cambiarCarrito([]);
    // Con señal y un solo vendedor, se va directo al seguimiento de esa compra: si es por QR, el QR sale ahí mismo
    // (02/11, pedido de Andrés: menos pasos). Si no, a Compras, donde está todo
    let creado: string | null = null;
    if (enLinea) {
      await bandeja.sincronizar();
      if (claves.length === 1) {
        const op = await bandeja.operacion(claves[0]);
        const id = (op?.respuesta as { id?: unknown } | undefined)?.id;
        if (op?.estado === 'aplicada' && typeof id === 'string') creado = id;
      }
    }
    setEnviando(false);
    vibrar.exito();
    navigation.reset({
      index: creado ? 1 : 0,
      routes: creado ? [{ name: 'Pestanas', params: { screen: 'Pedidos' } }, { name: 'Seguimiento', params: { id: creado } }] : [{ name: 'Pestanas', params: { screen: 'Pedidos' } }],
    });
  }

  return (
    <SafeAreaView style={e.pantalla} edges={['bottom']}>
      <ScrollView contentContainerStyle={e.contenido}>
        {!enLinea && (
          <View style={e.aviso}>
            <Icono nombre="cloud-offline-outline" color={COLOR.ambarTexto} />
            <Texto style={{ color: COLOR.ambarTexto, fontWeight: '600', flex: 1 }}>No hay señal. Guardamos tu pedido y se envía solo cuando vuelva.</Texto>
          </View>
        )}

        {/* 1. Dónde */}
        <Paso numero={1} titulo="Dónde lo entregamos" />
        <Tarjeta style={{ gap: 12 }}>
          {elegida ? (
            <>
              {elegida.latitud !== null && elegida.longitud !== null && <MapaChico punto={{ latitud: elegida.latitud, longitud: elegida.longitud }} alto={110} />}
              <View style={e.fila}>
                <View style={e.iconoRedondo}>
                  <Icono nombre={iconoDeEtiqueta(elegida.etiqueta)} color={COLOR.bosque} />
                </View>
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte">{elegida.etiqueta}</Texto>
                  <Texto v="gris" lineas={2}>
                    {[elegida.calle, elegida.zona].filter(Boolean).join(' · ')}
                  </Texto>
                  {!!elegida.referencia && (
                    <Texto v="chico" lineas={1}>
                      {elegida.referencia}
                    </Texto>
                  )}
                </View>
                <Tocable onPress={() => setCambiarDireccion(true)} style={e.cambiar} accessibilityRole="button" accessibilityLabel="Cambiar la dirección de entrega">
                  <Texto v="fuerte" style={{ fontSize: 13 }}>
                    Cambiar
                  </Texto>
                </Tocable>
              </View>
            </>
          ) : (
            <Boton texto="Elegir dónde entregar" icono="location" alTocar={() => navigation.navigate('NuevaDireccion')} />
          )}
        </Tarjeta>

        {/* 2. Qué */}
        <Paso numero={2} titulo={grupos.length === 1 ? 'Tu pedido' : `Tus ${grupos.length} pedidos`} />
        {grupos.map((g) => (
          <Tarjeta key={g.mayoristaId} style={{ gap: 10 }}>
            <View style={e.entre}>
              <View style={[e.fila, { flex: 1 }]}>
                <Icono nombre="storefront-outline" tamano={18} color={COLOR.texto2} />
                <Texto v="fuerte" lineas={1} style={{ flex: 1 }}>
                  {g.mayoristaNombre}
                </Texto>
              </View>
              <Texto v="precio">{bs(g.totalEstimadoCentavos)}</Texto>
            </View>
            {g.items.map((i) => (
              <View key={`${i.productoId}-${i.presentacion}`} style={e.fila}>
                <Foto producto={{ nombre: i.nombre, rubro: delCatalogo(i.productoId)?.rubro ?? 'Varios', foto: delCatalogo(i.productoId)?.foto ?? null }} alto={44} ancho={44} />
                <View style={{ flex: 1 }}>
                  <Texto lineas={1}>{i.nombre}</Texto>
                  <Texto v="gris">{cantidadConUnidad(i)}</Texto>
                </View>
                <Texto v="fuerte">{bs(totalDe(i))}</Texto>
              </View>
            ))}
          </Tarjeta>
        ))}

        {/* 3. Cómo pagas */}
        <Paso numero={3} titulo="Cómo pagas" />
        <View style={{ gap: 8 }}>
          {METODOS.map((m) => {
            const activo = metodo === m.id;
            return (
              <Tocable
                key={m.id}
                hundir={0.98}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo }}
                onPress={() => setMetodo(m.id)}
                style={[e.metodo, activo && e.metodoActivo]}
              >
                <View style={[e.iconoRedondo, activo && { backgroundColor: COLOR.lima }]}>
                  <Icono nombre={activo ? m.icono : (`${m.icono}-outline` as NombreDeIcono)} color={COLOR.bosque} />
                </View>
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte">{m.titulo}</Texto>
                  <Texto v="gris">{m.detalle}</Texto>
                </View>
                <Icono nombre={activo ? 'checkmark-circle' : 'ellipse-outline'} tamano={24} color={activo ? COLOR.bosque : COLOR.borde} />
              </Tocable>
            );
          })}
          {metodo === 'CREDITO' && (
            <View style={[e.aviso, { flexDirection: 'column', alignItems: 'stretch' }, !sinCupo.length && { backgroundColor: COLOR.verdeSuave }]}>
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
        <View style={e.entre}>
          <View>
            <Texto v="gris">Total estimado</Texto>
            <Texto v="t1">{bs(total)}</Texto>
          </View>
          <Texto v="chico" style={{ textAlign: 'right', maxWidth: 150 }}>
            El vendedor confirma el precio final al reservar
          </Texto>
        </View>
        <Boton
          tipo="oscuro"
          texto={!elegida ? 'Elige dónde entregar' : !enLinea ? 'Guardar pedido · sale al volver la señal' : grupos.length > 1 ? `Hacer los ${grupos.length} pedidos` : metodo === 'QR' ? `Pedir y pagar con QR · ${bs(total)}` : `Hacer el pedido · ${bs(total)}`}
          icono={enLinea ? 'bag-check' : 'time-outline'}
          cargando={enviando}
          deshabilitado={!grupos.length || !elegida || creditoNoAlcanza}
          alTocar={() => void hacerPedido()}
        />
      </View>

      <HojaDeDirecciones
        visible={cambiarDireccion}
        alCerrar={() => setCambiarDireccion(false)}
        alNueva={() => {
          setCambiarDireccion(false);
          navigation.navigate('NuevaDireccion');
        }}
      />
    </SafeAreaView>
  );
}

function Paso({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <View style={[e.fila, { marginTop: 4 }]}>
      <View style={e.numero}>
        <Texto v="fuerte" style={{ color: COLOR.lima, fontSize: 12 }}>
          {numero}
        </Texto>
      </View>
      <Texto v="t3">{titulo}</Texto>
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 12, paddingBottom: 24 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numero: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLOR.bosque, alignItems: 'center', justifyContent: 'center' },
  iconoRedondo: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLOR.limaSuave, alignItems: 'center', justifyContent: 'center' },
  cambiar: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: COLOR.limaSuave, justifyContent: 'center' },
  metodo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie },
  metodoActivo: { borderColor: COLOR.bosque, backgroundColor: COLOR.limaSuave },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: COLOR.ambarSuave },
  barra: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: COLOR.superficie, borderTopWidth: 1, borderTopColor: COLOR.borde },
});
