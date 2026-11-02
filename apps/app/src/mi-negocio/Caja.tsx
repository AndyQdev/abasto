import {
  bs,
  clienteDeFiado,
  existencias,
  precioDeVenta,
  registrarVenta,
  saldosDeFiado,
  seVende,
  tinte,
  type ClienteDeFiado,
  type DatosDeNegocio,
  type Existencia,
  type ItemDeVenta,
  type NegocioElegido,
} from '@abasto/comercio';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Animated, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { HojaInferior, Tocable, useLatido } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import type { Imagen } from '../ilustraciones';
import { ahora, nuevoId, useInventario } from '../inventario';
import { COLOR, FUENTE, SOMBRA, TINTES } from '../tema';
import { useVuelo, type Origen } from '../vuelo';
import { Campo, CabezaDeSeccion, ContenidoDeHoja, ui } from './ui';

/** Lo que lleva la venta: cuántas de cada artículo. Vive en «Mi negocio» para que el carrito flote fuera de la lista */
export interface Venta {
  ticket: Map<string, number>;
  cambiar: (x: Existencia, d: number) => void;
  vaciar: () => void;
}

export function useVenta(): Venta {
  const [ticket, setTicket] = useState<Map<string, number>>(new Map());
  const cambiar = useCallback((x: Existencia, d: number) => {
    setTicket((t) => {
      const n = new Map(t);
      // Nunca más de lo que hay
      const nueva = Math.max(0, Math.min((n.get(x.articulo.id) ?? 0) + d, x.cantidad));
      if (nueva <= 0) n.delete(x.articulo.id);
      else n.set(x.articulo.id, nueva);
      return n;
    });
  }, []);
  const vaciar = useCallback(() => setTicket(new Map()), []);
  return { ticket, cambiar, vaciar };
}

/** Lo que se puede vender (lo hecho primero), el precio de cada uno y las líneas del ticket con su total */
function useCuenta(negocio: NegocioElegido, datos: DatosDeNegocio, ticket: Map<string, number>) {
  const vendibles = useMemo(
    () =>
      existencias(datos)
        .filter((x) => !x.agotado && seVende(negocio, x.articulo))
        .sort((a, b) => Number(b.articulo.clase === 'HECHO') - Number(a.articulo.clase === 'HECHO') || a.articulo.nombre.localeCompare(b.articulo.nombre, 'es')),
    [datos, negocio],
  );
  const precioDe = (x: Existencia) => precioDeVenta(x, negocio)?.centavos ?? 0;
  const lineas = vendibles.filter((x) => (ticket.get(x.articulo.id) ?? 0) > 0);
  const unidades = lineas.reduce((s, x) => s + (ticket.get(x.articulo.id) ?? 0), 0);
  const total = lineas.reduce((s, x) => s + (ticket.get(x.articulo.id) ?? 0) * precioDe(x), 0);
  return { vendibles, precioDe, lineas, unidades, total };
}

/**
 * Vender (fase 4, rediseñada el 02/11): la caja rápida de la tienda y del productor. Se toca lo que se vende (cada
 * toque suma uno y la foto vuela al carrito flotante); el carrito muestra cuánto va y, al tocarlo, se abre con lo
 * elegido para cobrar o fiar. No deja vender más de lo que hay. El productor ve primero lo que hace.
 */
export function Caja({
  negocio,
  datos,
  imagenDe,
  venta,
  destino,
}: {
  negocio: NegocioElegido;
  datos: DatosDeNegocio;
  imagenDe: (x: Existencia) => Imagen;
  venta: Venta;
  /** El carrito flotante, adonde vuela la foto */
  destino?: Origen;
}) {
  const [buscar, setBuscar] = useState('');
  const volar = useVuelo();
  // Tres por fila: el ancho de la pantalla menos los márgenes (16 + 16) y dos huecos de 10
  const ancho = (useWindowDimensions().width - 32 - 20) / 3;
  const { vendibles, precioDe } = useCuenta(negocio, datos, venta.ticket);
  const filtro = buscar.trim().toLowerCase();
  const visibles = filtro ? vendibles.filter((x) => x.articulo.nombre.toLowerCase().includes(filtro)) : vendibles;

  if (!vendibles.length) {
    return (
      <View style={ui.vacio}>
        <Icono nombre="storefront-outline" tamano={20} color={COLOR.texto3} />
        <Texto v="gris" style={{ flex: 1 }}>
          {negocio.tipo === 'productor' ? 'Cuando registres una tanda o tengas productos, aquí los vendes.' : 'Cuando te llegue tu mercadería, aquí la vendes con un toque.'}
        </Texto>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <CabezaDeSeccion icono="cash" titulo="Vender" subtitulo="Toca lo que vendes; cada toque suma uno" />
      <View style={e.buscador}>
        <Icono nombre="search" tamano={18} color={COLOR.texto3} />
        <TextInput accessibilityLabel="Buscar en tu inventario" value={buscar} onChangeText={setBuscar} placeholder="Buscar…" placeholderTextColor={COLOR.texto3} style={e.entradaBuscar} />
      </View>
      <View style={e.grilla}>
        {visibles.map((x) => (
          <TarjetaDeVenta
            key={x.articulo.id}
            x={x}
            ancho={ancho}
            imagen={imagenDe(x)}
            precio={precioDe(x)}
            cuantas={venta.ticket.get(x.articulo.id) ?? 0}
            alTocar={(foto) => {
              if ((venta.ticket.get(x.articulo.id) ?? 0) >= x.cantidad) return;
              venta.cambiar(x, 1);
              volar(foto, imagenDe(x), destino);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function TarjetaDeVenta({ x, ancho, imagen, precio, cuantas, alTocar }: { x: Existencia; ancho: number; imagen: Imagen; precio: number; cuantas: number; alTocar: (foto: Origen) => void }) {
  const foto = useRef<ComponentRef<typeof View>>(null);
  const lleno = cuantas >= x.cantidad;
  return (
    <Tocable
      onPress={() => alTocar(foto)}
      style={[e.producto, { width: ancho }, cuantas > 0 && e.productoElegido, lleno && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`Vender ${x.articulo.nombre}`}
    >
      <View ref={foto} collapsable={false} style={[e.fotoProducto, { backgroundColor: x.articulo.rubro ? TINTES[tinte(x.articulo.rubro)] : COLOR.limaSuave }]}>
        <Image source={imagen} style={ui.imagenFila} contentFit="contain" />
        {cuantas > 0 && (
          <View style={e.cuantos}>
            <Texto style={e.textoCuantos}>{cuantas}</Texto>
          </View>
        )}
      </View>
      <Texto v="fuerte" lineas={2} style={{ fontSize: 13 }}>
        {x.articulo.nombre}
      </Texto>
      <Texto style={e.precio}>{bs(precio)}</Texto>
      <Texto v="chico" lineas={1}>
        {lleno ? 'No hay más' : `Hay ${x.texto}`}
      </Texto>
    </Tocable>
  );
}

/**
 * El carrito de la venta: flota abajo, encima de la barra, mientras haya algo en la venta, y late cuando le llega un
 * producto. Al tocarlo se abre la hoja con lo elegido (− y +), el total y «Cobrado» o «Fiado».
 */
export function CarritoDeVenta({
  negocio,
  datos,
  imagenDe,
  venta,
  abajo,
  destino,
  alVendido,
}: {
  negocio: NegocioElegido;
  datos: DatosDeNegocio;
  imagenDe: (x: Existencia) => Imagen;
  venta: Venta;
  /** Lo que ocupa la barra de abajo */
  abajo: number;
  destino: Origen;
  alVendido: (texto: string) => void;
}) {
  const { aplicar } = useInventario();
  const { lineas, unidades, total, precioDe } = useCuenta(negocio, datos, venta.ticket);
  const [abierta, setAbierta] = useState(false);
  const [fiando, setFiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latido, latir] = useLatido();
  const antes = useRef(unidades);
  useEffect(() => {
    const subio = unidades > antes.current;
    antes.current = unidades;
    if (unidades === 0) setAbierta(false);
    if (!subio) return undefined;
    // Late cuando llega el producto que vuela (el vuelo dura ~0,7 s)
    const t = setTimeout(latir, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades]);

  const cobrar = async (cliente?: ClienteDeFiado, clienteNuevo?: boolean) => {
    const items: ItemDeVenta[] = lineas.map((x) => ({ articuloId: x.articulo.id, cantidad: venta.ticket.get(x.articulo.id) ?? 0, precioUnitarioCentavos: precioDe(x) }));
    try {
      const r = registrarVenta(datos, items, cliente ? { forma: 'FIADO', cliente } : { forma: 'CONTADO' }, ahora(), nuevoId());
      await aplicar({ ventas: [r.venta], movimientos: r.movimientos, fiados: r.fiado ? [r.fiado] : [], clientes: clienteNuevo && cliente ? [cliente] : [] });
      venta.vaciar();
      setFiando(false);
      setAbierta(false);
      setError(null);
      alVendido(cliente ? `Fiado a ${cliente.nombre}: ${bs(r.venta.totalCentavos)}` : `Venta cobrada: ${bs(r.venta.totalCentavos)}`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo registrar la venta');
    }
  };

  return (
    <>
      {/* Siempre montado (aunque esté vacío) para que el vuelo sepa adónde ir */}
      <View style={[e.lugarCarrito, { bottom: abajo }]} pointerEvents="box-none">
        <Animated.View style={{ transform: [{ scale: latido }], opacity: lineas.length ? 1 : 0 }} pointerEvents={lineas.length ? 'auto' : 'none'}>
          <Tocable onPress={() => setAbierta(true)} style={e.carrito} accessibilityRole="button" accessibilityLabel={`Ver tu venta: ${unidades} por ${bs(total)}`}>
            <View ref={destino} collapsable={false} style={e.iconoCarrito}>
              <Icono nombre="cart" tamano={22} color={COLOR.bosque} />
              <View style={e.burbuja}>
                <Texto style={e.textoBurbuja}>{unidades}</Texto>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Texto style={e.textoCarrito}>Tu venta</Texto>
              <Texto style={e.detalleCarrito}>{lineas.length === 1 ? '1 producto' : `${lineas.length} productos`} · toca para cobrar</Texto>
            </View>
            <Texto style={e.totalCarrito}>{bs(total)}</Texto>
            <Icono nombre="chevron-up" tamano={20} color={COLOR.lima} />
          </Tocable>
        </Animated.View>
      </View>

      <HojaInferior visible={abierta && !fiando && lineas.length > 0} alCerrar={() => setAbierta(false)}>
        <ContenidoDeHoja>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Texto v="t2" style={{ flex: 1 }}>
              Tu venta
            </Texto>
            <Tocable onPress={venta.vaciar} accessibilityRole="button" accessibilityLabel="Vaciar la venta">
              <Texto v="chico">Vaciar</Texto>
            </Tocable>
          </View>
          {lineas.map((x) => {
            const n = venta.ticket.get(x.articulo.id) ?? 0;
            return (
              <View key={x.articulo.id} style={e.lineaTicket}>
                <View style={[e.fotoLinea, { backgroundColor: x.articulo.rubro ? TINTES[tinte(x.articulo.rubro)] : COLOR.limaSuave }]}>
                  <Image source={imagenDe(x)} style={ui.imagenFila} contentFit="contain" />
                </View>
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte" lineas={1}>
                    {x.articulo.nombre}
                  </Texto>
                  <Texto v="chico">{bs(precioDe(x))} c/u</Texto>
                </View>
                <Tocable onPress={() => venta.cambiar(x, -1)} style={e.botonChico} accessibilityRole="button" accessibilityLabel={`Uno menos de ${x.articulo.nombre}`}>
                  <Icono nombre="remove" tamano={16} color={COLOR.bosque} />
                </Tocable>
                <Texto style={e.cantidadTicket}>{n}</Texto>
                <Tocable onPress={() => venta.cambiar(x, 1)} style={[e.botonChico, { backgroundColor: COLOR.lima }]} accessibilityRole="button" accessibilityLabel={`Uno más de ${x.articulo.nombre}`}>
                  <Icono nombre="add" tamano={16} color={COLOR.bosque} />
                </Tocable>
                <Texto style={e.subtotal}>{bs(n * precioDe(x))}</Texto>
              </View>
            );
          })}
          <View style={e.totalFila}>
            <Texto v="fuerte">Total</Texto>
            <Texto style={e.total}>{bs(total)}</Texto>
          </View>
          {error && <Falla texto={error} />}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Boton tipo="oscuro" texto="Cobrado" icono="checkmark" alTocar={() => void cobrar()} />
            </View>
            <View style={{ flex: 1 }}>
              <Boton tipo="secundario" texto="Fiado" icono="book" alTocar={() => setFiando(true)} />
            </View>
          </View>
        </ContenidoDeHoja>
      </HojaInferior>
      <HojaDeFiar visible={fiando} datos={datos} total={total} alCerrar={() => setFiando(false)} alElegir={(c, nuevo) => void cobrar(c, nuevo)} />
    </>
  );
}

/** ¿A quién le fías? Los de siempre (con lo que ya deben) o uno nuevo */
function HojaDeFiar({ visible, datos, total, alCerrar, alElegir }: { visible: boolean; datos: DatosDeNegocio; total: number; alCerrar: () => void; alElegir: (c: ClienteDeFiado, nuevo: boolean) => void }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saldos = saldosDeFiado(datos);
  const nuevo = () => {
    try {
      alElegir(clienteDeFiado(nombre, null, ahora(), nuevoId()), true);
      setNombre('');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Revisa el nombre');
    }
  };
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <ContenidoDeHoja>
        <View style={{ gap: 2 }}>
          <Texto v="t2">¿A quién le fías?</Texto>
          <Texto v="gris">{bs(total)} quedan anotados en su cuaderno.</Texto>
        </View>
        {saldos.map((s) => (
          <Tocable key={s.cliente.id} onPress={() => alElegir(s.cliente, false)} style={ui.fila} accessibilityRole="button" accessibilityLabel={`Fiar a ${s.cliente.nombre}`}>
            <Icono nombre="person-circle" tamano={32} color={COLOR.bosque} />
            <View style={{ flex: 1 }}>
              <Texto v="fuerte">{s.cliente.nombre}</Texto>
              <Texto v="chico">{s.saldoCentavos > 0 ? `Ya debe ${bs(s.saldoCentavos)}` : 'Al día'}</Texto>
            </View>
            <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
          </Tocable>
        ))}
        <Campo etiqueta="Alguien nuevo" valor={nombre} alCambiar={setNombre} ejemplo="Doña Carmen" mayusculas />
        {error && <Falla texto={error} />}
        <Boton tipo="oscuro" texto="Fiar a alguien nuevo" icono="person-add" deshabilitado={nombre.trim().length < 2} alTocar={nuevo} />
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

const e = StyleSheet.create({
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 46, borderRadius: 23, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  entradaBuscar: { flex: 1, fontFamily: FUENTE.semi, fontSize: 15, color: COLOR.texto },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  producto: { padding: 8, gap: 3, borderRadius: 18, backgroundColor: COLOR.superficie, borderWidth: 2, borderColor: 'transparent', ...SOMBRA },
  productoElegido: { borderColor: COLOR.bosque },
  fotoProducto: { height: 76, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cuantos: { position: 'absolute', top: 4, right: 4, minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: COLOR.bosque, alignItems: 'center', justifyContent: 'center' },
  textoCuantos: { fontFamily: FUENTE.negra, fontSize: 13, color: COLOR.lima },
  precio: { fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.bosque },
  lineaTicket: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fotoLinea: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  botonChico: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLOR.tenue, alignItems: 'center', justifyContent: 'center' },
  cantidadTicket: { minWidth: 22, textAlign: 'center', fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.texto },
  subtotal: { minWidth: 76, textAlign: 'right', fontFamily: FUENTE.fuerte, color: COLOR.texto },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLOR.borde, paddingTop: 10 },
  total: { fontFamily: FUENTE.negra, fontSize: 26, color: COLOR.bosque, letterSpacing: -0.6 },
  lugarCarrito: { position: 'absolute', left: 16, right: 16 },
  carrito: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, borderRadius: 26, backgroundColor: COLOR.bosque, ...SOMBRA },
  iconoCarrito: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  burbuja: { position: 'absolute', top: -4, right: -6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: COLOR.ambar, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLOR.bosque },
  textoBurbuja: { fontFamily: FUENTE.negra, fontSize: 11, color: COLOR.bosque },
  textoCarrito: { fontFamily: FUENTE.negra, fontSize: 16, color: '#fff' },
  detalleCarrito: { fontFamily: FUENTE.semi, fontSize: 12, color: '#CFE3D6' },
  totalCarrito: { fontFamily: FUENTE.negra, fontSize: 18, color: COLOR.lima, letterSpacing: -0.4 },
});
