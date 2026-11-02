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
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Aparecer, HojaInferior, Tocable } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import type { Imagen } from '../ilustraciones';
import { ahora, nuevoId, useInventario } from '../inventario';
import { COLOR, FUENTE, SOMBRA, TINTES } from '../tema';
import { Campo, CabezaDeSeccion, ContenidoDeHoja, ui } from './ui';

/**
 * Vender (fase 4): la caja rápida de la tienda y del productor. Se toca lo que se vende (cada toque suma uno), se ve el
 * total y se elige «Cobrado» o «Fiado». Descuenta del inventario y guarda la venta con su costo. No deja vender más
 * de lo que hay. El productor ve primero lo que hace.
 */
export function Caja({ negocio, datos, imagenDe, alVendido }: { negocio: NegocioElegido; datos: DatosDeNegocio; imagenDe: (x: Existencia) => Imagen; alVendido: (texto: string) => void }) {
  const { aplicar } = useInventario();
  const [ticket, setTicket] = useState<Map<string, number>>(new Map());
  const [buscar, setBuscar] = useState('');
  const [fiando, setFiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tres por fila: el ancho de la pantalla menos los márgenes (16 + 16) y dos huecos de 10
  const ancho = (useWindowDimensions().width - 32 - 20) / 3;

  const vendibles = useMemo(
    () =>
      existencias(datos)
        .filter((x) => !x.agotado && seVende(negocio, x.articulo))
        .sort((a, b) => Number(b.articulo.clase === 'HECHO') - Number(a.articulo.clase === 'HECHO') || a.articulo.nombre.localeCompare(b.articulo.nombre, 'es')),
    [datos],
  );
  const filtro = buscar.trim().toLowerCase();
  const visibles = filtro ? vendibles.filter((x) => x.articulo.nombre.toLowerCase().includes(filtro)) : vendibles;
  const precioDe = (x: Existencia) => precioDeVenta(x, negocio)?.centavos ?? 0;
  const lineas = vendibles.filter((x) => (ticket.get(x.articulo.id) ?? 0) > 0);
  const total = lineas.reduce((s, x) => s + (ticket.get(x.articulo.id) ?? 0) * precioDe(x), 0);

  const cambiar = (x: Existencia, d: number) => {
    setError(null);
    setTicket((t) => {
      const n = new Map(t);
      const nueva = Math.max(0, Math.min((n.get(x.articulo.id) ?? 0) + d, x.cantidad));
      if (nueva <= 0) n.delete(x.articulo.id);
      else n.set(x.articulo.id, nueva);
      return n;
    });
  };

  const cobrar = async (cliente?: ClienteDeFiado, clienteNuevo?: boolean) => {
    const items: ItemDeVenta[] = lineas.map((x) => ({ articuloId: x.articulo.id, cantidad: ticket.get(x.articulo.id) ?? 0, precioUnitarioCentavos: precioDe(x) }));
    try {
      const r = registrarVenta(datos, items, cliente ? { forma: 'FIADO', cliente } : { forma: 'CONTADO' }, ahora(), nuevoId());
      await aplicar({ ventas: [r.venta], movimientos: r.movimientos, fiados: r.fiado ? [r.fiado] : [], clientes: clienteNuevo && cliente ? [cliente] : [] });
      setTicket(new Map());
      setFiando(false);
      alVendido(cliente ? `Fiado a ${cliente.nombre}: ${bs(r.venta.totalCentavos)}` : `Venta cobrada: ${bs(r.venta.totalCentavos)}`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo registrar la venta');
    }
  };

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
        {visibles.map((x) => {
          const n = ticket.get(x.articulo.id) ?? 0;
          return (
            <Tocable key={x.articulo.id} onPress={() => cambiar(x, 1)} style={[e.producto, { width: ancho }, n > 0 && e.productoElegido]} accessibilityRole="button" accessibilityLabel={`Vender ${x.articulo.nombre}`}>
              <View style={[e.fotoProducto, { backgroundColor: x.articulo.rubro ? TINTES[tinte(x.articulo.rubro)] : COLOR.limaSuave }]}>
                <Image source={imagenDe(x)} style={ui.imagenFila} contentFit="contain" />
                {n > 0 && (
                  <View style={e.cuantos}>
                    <Texto style={e.textoCuantos}>{n}</Texto>
                  </View>
                )}
              </View>
              <Texto v="fuerte" lineas={2} style={{ fontSize: 13 }}>
                {x.articulo.nombre}
              </Texto>
              <Texto style={e.precio}>{bs(precioDe(x))}</Texto>
              <Texto v="chico" lineas={1}>
                Hay {x.texto}
              </Texto>
            </Tocable>
          );
        })}
      </View>

      {lineas.length > 0 && (
        <Aparecer>
          <View style={e.ticket}>
            <Texto style={e.tituloTicket}>Tu venta</Texto>
            {lineas.map((x) => (
              <View key={x.articulo.id} style={e.lineaTicket}>
                <Texto style={{ flex: 1, color: '#fff' }} lineas={1}>
                  {x.articulo.nombre}
                </Texto>
                <Tocable onPress={() => cambiar(x, -1)} style={e.botonChico} accessibilityRole="button" accessibilityLabel={`Uno menos de ${x.articulo.nombre}`}>
                  <Icono nombre="remove" tamano={16} color={COLOR.bosque} />
                </Tocable>
                <Texto style={e.cantidadTicket}>{ticket.get(x.articulo.id)}</Texto>
                <Tocable onPress={() => cambiar(x, 1)} style={e.botonChico} accessibilityRole="button" accessibilityLabel={`Uno más de ${x.articulo.nombre}`}>
                  <Icono nombre="add" tamano={16} color={COLOR.bosque} />
                </Tocable>
                <Texto style={e.subtotal}>{bs((ticket.get(x.articulo.id) ?? 0) * precioDe(x))}</Texto>
              </View>
            ))}
            <View style={e.totalFila}>
              <Texto style={{ color: COLOR.limaMedia, fontFamily: FUENTE.fuerte }}>Total</Texto>
              <Texto style={e.total}>{bs(total)}</Texto>
            </View>
            {error && <Falla texto={error} />}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Boton texto="Cobrado" icono="checkmark" alTocar={() => void cobrar()} />
              </View>
              <View style={{ flex: 1 }}>
                <Boton tipo="secundario" texto="Fiado" icono="book" alTocar={() => setFiando(true)} />
              </View>
            </View>
          </View>
        </Aparecer>
      )}
      <HojaDeFiar visible={fiando} datos={datos} total={total} alCerrar={() => setFiando(false)} alElegir={(c, nuevo) => void cobrar(c, nuevo)} />
    </View>
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
  ticket: { gap: 10, padding: 16, borderRadius: 24, backgroundColor: COLOR.bosque },
  tituloTicket: { fontFamily: FUENTE.negra, fontSize: 18, color: COLOR.lima },
  lineaTicket: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botonChico: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLOR.limaMedia, alignItems: 'center', justifyContent: 'center' },
  cantidadTicket: { minWidth: 22, textAlign: 'center', fontFamily: FUENTE.negra, color: '#fff' },
  subtotal: { minWidth: 82, textAlign: 'right', fontFamily: FUENTE.fuerte, color: '#fff' },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 10 },
  total: { fontFamily: FUENTE.negra, fontSize: 26, color: COLOR.lima, letterSpacing: -0.6 },
});
