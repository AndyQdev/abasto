/**
 * El vigía de las entregas (02/11, pedido de Andrés): cuando el repartidor marca «entregado», la persona ve el festejo
 * una sola vez, esté en la pantalla que esté (llega el aviso en tiempo real) o la próxima vez que abra la app si no
 * tenía señal. Después la lleva a «Mi negocio» con lo que llegó resaltado.
 *
 * Qué compras ya se festejaron se guarda en el teléfono (es solo para no repetir el festejo). La primera vez en un
 * teléfono, lo entregado de antes no se festeja.
 */
import { MIS_COMPRAS, type Pedido, type TipoDeNegocio } from '@abasto/comercio';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { graphql } from './api';
import { useEstado } from './estado';
import { CompraEntregada, type ProductoQueLlego } from './festejos';
import { guardado } from './guardado';
import { ILUSTRACION } from './ilustraciones';
import { navegacion } from './navegar';
import { useNegocio } from './NegocioInicio';
import { useSesion } from './sesion';
import { unaALaVez, useAvisosDePedidos } from './tiempo-real';

/** Qué entregas hay que festejar: las que no se vieron todavía, la más nueva primero. `null` = primera vez en el teléfono */
export function entregasNuevas(compras: Pick<Pedido, 'id' | 'estado' | 'creadoEn'>[], vistas: string[] | null) {
  const entregadas = compras.filter((p) => p.estado === 'ENTREGADO');
  const todas = entregadas.map((p) => p.id);
  if (vistas === null) return { festejar: [], vistas: todas };
  const nuevas = entregadas.filter((p) => !vistas.includes(p.id)).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  return { festejar: nuevas.map((p) => p.id), vistas: [...new Set([...vistas, ...todas])] };
}

/** Lo que va a «Mi negocio» al terminar el festejo: qué resaltar */
export function irAMiNegocio(recien: string[]) {
  if (navegacion.isReady()) navegacion.navigate('Pestanas', { screen: 'MiNegocio', params: { recien, vez: Date.now() } });
}

export function VigiaDeEntregas() {
  const { enLinea, catalogo } = useEstado();
  const { usuario } = useSesion();
  const tipo: TipoDeNegocio = useNegocio().negocio?.tipo ?? 'tienda';
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const clave = `entregas-festejadas:${usuario?.id ?? 'sin-sesion'}`;
  const vistas = useRef<string[] | null | undefined>(undefined);

  const revisar = useMemo(
    () =>
      unaALaVez(async () => {
        if (!enLinea || !usuario) return;
        let compras: Pedido[];
        try {
          compras = (await graphql<{ misCompras: Pedido[] }>(MIS_COMPRAS)).misCompras;
        } catch {
          return; // Sin servidor: se revisa al volver
        }
        if (vistas.current === undefined) vistas.current = await guardado.leer<string[]>(clave);
        const r = entregasNuevas(compras, vistas.current ?? null);
        vistas.current = r.vistas;
        await guardado.escribir(clave, r.vistas);
        const primera = compras.find((p) => p.id === r.festejar[0]);
        if (primera) setPedido(primera);
      }),
    [enLinea, usuario, clave],
  );
  // Al abrir, al volver la señal y con cada aviso de un pedido
  useAvisosDePedidos(
    () => void revisar(),
    () => void revisar(),
  );
  useEffect(() => {
    // Un momento después de abrir (o de volver la señal), para no competir con la carga del Inicio
    const t = setTimeout(() => void revisar(), 1500);
    return () => clearTimeout(t);
  }, [revisar]);

  const productos: ProductoQueLlego[] = useMemo(
    () =>
      (pedido?.lineas ?? []).map((l) => {
        const p = catalogo.productos.find((x) => x.id === l.producto.id);
        return { id: l.producto.id, nombre: l.producto.nombre ?? p?.nombre ?? 'Producto', rubro: l.producto.rubro ?? p?.rubro ?? '', foto: p?.foto ?? null };
      }),
    [pedido, catalogo.productos],
  );

  const cerrar = useCallback(() => setPedido(null), []);
  const ir = useCallback(() => {
    const recien = productos.map((p) => p.id);
    setPedido(null);
    irAMiNegocio(recien);
  }, [productos]);

  if (!pedido) return <Precarga />;
  return <CompraEntregada visible codigo={pedido.codigo} productos={productos} tipo={tipo} alIr={ir} alCerrar={cerrar} />;
}

/**
 * Las ilustraciones de las escenas y los festejos se bajan al abrir la app (invisibles): así, cuando cambia el estado o
 * llega el festejo, ya están y no aparece un hueco mientras cargan (en la app de desarrollo vienen de Metro por wifi).
 */
const PRECARGAR = [
  ILUSTRACION.escenaPagar,
  ILUSTRACION.escenaRevisa,
  ILUSTRACION.escenaPrepara,
  ILUSTRACION.escenaCamino,
  ILUSTRACION.pedidoEntregado,
  ILUSTRACION.pagoExitoso,
  ILUSTRACION.estanteInventario,
];

function Precarga() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PRECARGAR.map((x, i) => (
        <Image key={i} source={x} style={{ width: 1, height: 1 }} cachePolicy="memory-disk" />
      ))}
    </View>
  );
}
