import { estadoVisible, fechaHora, MIS_COMPRAS, nombreCorto, pedidoDeLaSemana, porPagar, productos as cuantos, terminado, titularDelPedido, type Pedido } from '@abasto/comercio';
import type { OperacionLocal } from '@abasto/bandeja';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Tocable } from '../animacion';
import { graphql } from '../api';
import { useEspacioBarra } from '../BarraInferior';
import { bandeja } from '../bandeja-pedidos';
import { Boton, colorDeClase, Falla, Icono, Insignia, Texto, Vacio } from '../componentes';
import { useEstado } from '../estado';
import { guardado } from '../guardado';
import { ILUSTRACION } from '../ilustraciones';
import { ProgresoChico, Pulso } from '../linea-de-tiempo';
import type { PantallaDePestana } from '../navegacion';
import { COLOR, FUENTE, SOMBRA } from '../tema';
import { unaALaVez, useAvisosDePedidos } from '../tiempo-real';

/**
 * Compras (antes «Mis pedidos»; 02/11, pedido de Andrés: «mucho más fácil, menos pasos, más directo»). Arriba lo que
 * está en curso, cada compra con lo que pasa ahora, su barrita de pasos y, si falta pagar, «Pagar con QR» a un toque.
 * Abajo las anteriores, con «Pedir de nuevo». Sin filtros. Se actualiza en tiempo real (Conecta), nunca preguntando
 * cada pocos segundos; la ruedita solo sale al tirar.
 */
export function Pedidos({ navigation }: PantallaDePestana<'Pedidos'>) {
  const espacio = useEspacioBarra();
  const { enLinea, catalogo, agregarAlCarrito, abrirCarrito } = useEstado();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [enTelefono, setEnTelefono] = useState<OperacionLocal[]>([]);
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
  useFocusEffect(
    useCallback(() => {
      void traer();
    }, [traer]),
  );
  useEffect(() => {
    void traer();
  }, [traer, enTelefono.length]);
  useAvisosDePedidos(() => void traer(), () => void traer());

  const tirar = async () => {
    setRefrescando(true);
    await traer();
    setRefrescando(false);
  };

  const vendedor = (id: string) => catalogo.mayoristas.find((m) => m.id === id)?.nombre ?? id;
  const ordenados = [...pedidos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  const enCurso = ordenados.filter((p) => !terminado(p));
  const anteriores = ordenados.filter(terminado);
  const abrir = (p: Pedido) => navigation.navigate('Seguimiento', { id: p.id });
  const pedirDeNuevo = (p: Pedido) => {
    const r = pedidoDeLaSemana([p], catalogo.productos);
    if (!r) return;
    r.items.forEach((i) => agregarAlCarrito(i));
    abrirCarrito();
  };

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={[e.contenido, { paddingBottom: espacio }]} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => void tirar()} />}>
        <View>
          <Texto v="t1">Compras</Texto>
          <Texto v="gris">Lo que le pediste a Abasto, paso a paso</Texto>
        </View>

        {enTelefono.length > 0 && (
          <View style={e.enTelefono}>
            <Icono nombre="cloud-offline" tamano={20} color={COLOR.ambarTexto} />
            <View style={{ flex: 1 }}>
              <Texto v="fuerte" style={{ color: COLOR.ambarTexto }}>
                {enTelefono.length === 1 ? '1 compra espera señal' : `${enTelefono.length} compras esperan señal`}
              </Texto>
              <Texto v="chico">
                {enTelefono.some((o) => o.estado !== 'pendiente')
                  ? (enTelefono.find((o) => o.estado !== 'pendiente')?.error ?? 'No se pudo enviar')
                  : `Para ${enTelefono.map((o) => nombreCorto(vendedor(String(o.datos.mayoristaId)))).join(', ')}. Sale sola cuando vuelva la señal.`}
              </Texto>
            </View>
          </View>
        )}
        {error && <Falla texto={error} />}

        {!pedidos.length && !enTelefono.length ? (
          <Vacio imagen={ILUSTRACION.vacioPedidos} titulo="Todavía no compraste" detalle="Cuando pidas, aquí ves en qué va cada compra.">
            <Boton texto="Ir a comprar" icono="cart" alTocar={() => navigation.navigate('Inicio')} />
          </Vacio>
        ) : null}

        {enCurso.length > 0 && <Texto v="t3">En curso</Texto>}
        {enCurso.map((p, i) => (
          <Aparecer key={p.id} orden={i}>
            <CompraEnCurso pedido={p} vendedor={nombreCorto(p.mayorista.nombre ?? vendedor(p.mayorista.id))} alAbrir={() => abrir(p)} />
          </Aparecer>
        ))}

        {anteriores.length > 0 && <Texto v="t3">Anteriores</Texto>}
        {anteriores.map((p) => {
          const estado = estadoVisible(p);
          const entregado = p.estado === 'ENTREGADO';
          return (
            <Tocable key={p.id} onPress={() => abrir(p)} style={e.anterior} accessibilityRole="button" accessibilityLabel={`Compra ${p.codigo}: ${estado.texto}`}>
              <View style={[e.iconoAnterior, !entregado && { backgroundColor: COLOR.rojoSuave }]}>
                <Icono nombre={entregado ? 'checkmark' : 'close'} tamano={18} color={entregado ? COLOR.lima : COLOR.rojoTexto} />
              </View>
              <View style={{ flex: 1 }}>
                <Texto v="fuerte">
                  {p.total.texto} · {cuantos(p.lineas.length)}
                </Texto>
                <Texto v="chico">
                  #{p.codigo} · {fechaHora(p.creadoEn)}
                </Texto>
              </View>
              {entregado ? (
                <Tocable onPress={() => pedirDeNuevo(p)} style={e.deNuevo} accessibilityRole="button" accessibilityLabel={`Pedir de nuevo la compra ${p.codigo}`}>
                  <Icono nombre="repeat" tamano={16} color={COLOR.bosque} />
                  <Texto style={e.textoDeNuevo}>Pedir de nuevo</Texto>
                </Tocable>
              ) : (
                <Insignia texto={estado.texto} color={colorDeClase(estado.clase)} />
              )}
            </Tocable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Una compra en curso: qué pasa ahora (en grande), la barrita de pasos y, si falta pagar, el botón para pagar */
function CompraEnCurso({ pedido: p, vendedor, alAbrir }: { pedido: Pedido; vendedor: string; alAbrir: () => void }) {
  const titular = titularDelPedido(p);
  const pagar = porPagar(p);
  return (
    <Tocable onPress={alAbrir} style={[e.enCurso, pagar && e.enCursoPorPagar]} accessibilityRole="button" accessibilityLabel={`Compra ${p.codigo}: ${titular.titulo}`}>
      <View style={e.entre}>
        <View style={e.vivo}>
          <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
            <Pulso tamano={10} color={pagar ? COLOR.ambar : COLOR.lima} />
            <View style={[e.puntoVivo, pagar && { backgroundColor: COLOR.ambar }]} />
          </View>
          <Texto style={e.textoVivo}>
            {vendedor} · #{p.codigo}
          </Texto>
        </View>
        <Texto v="fuerte">{p.total.centavos ? p.total.texto : '—'}</Texto>
      </View>
      <View style={{ gap: 2 }}>
        <Texto style={e.titular}>{titular.titulo}</Texto>
        <Texto v="chico">{titular.detalle}</Texto>
      </View>
      <ProgresoChico pedido={p} />
      {pagar ? (
        <Boton texto={`Pagar con QR · ${p.total.texto}`} icono="qr-code" alTocar={alAbrir} />
      ) : (
        <View style={[e.entre, { justifyContent: 'flex-end' }]}>
          <Texto style={e.verMas}>Ver el seguimiento</Texto>
          <Icono nombre="chevron-forward" tamano={16} color={COLOR.bosque} />
        </View>
      )}
    </Tocable>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 12 },
  entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  enTelefono: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 18, backgroundColor: COLOR.ambarSuave },
  enCurso: { gap: 12, padding: 16, borderRadius: 24, backgroundColor: COLOR.superficie, ...SOMBRA },
  enCursoPorPagar: { borderWidth: 2, borderColor: COLOR.ambar },
  vivo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  puntoVivo: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLOR.lima, borderWidth: 1, borderColor: COLOR.bosque },
  textoVivo: { fontFamily: FUENTE.fuerte, fontSize: 13, color: COLOR.texto2 },
  titular: { fontFamily: FUENTE.negra, fontSize: 19, color: COLOR.texto, letterSpacing: -0.4 },
  verMas: { fontFamily: FUENTE.fuerte, fontSize: 13, color: COLOR.bosque },
  anterior: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: COLOR.superficie, ...SOMBRA },
  iconoAnterior: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.bosque },
  deNuevo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 34, borderRadius: 17, backgroundColor: COLOR.lima },
  textoDeNuevo: { fontFamily: FUENTE.fuerte, fontSize: 12.5, color: COLOR.bosque },
});
