import {
  bs,
  escalasConPrecio,
  itemDeCarrito,
  itemDeLista,
  listaVigente,
  separarContenido,
  type DatosDeNegocio,
  type ItemDeCarrito,
  type ItemDeLista,
  type Producto,
} from '@abasto/comercio';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { HojaInferior, Tocable } from '../animacion';
import { Boton, Icono, Texto } from '../componentes';
import { fotoDe } from '../ilustraciones';
import { ahora, nuevoId, useInventario } from '../inventario';
import { COLOR, FUENTE } from '../tema';
import { BotonDeAccion, CabezaDeSeccion, ContenidoDeHoja, ui } from './ui';

/**
 * «Mi lista» del hogar (fase 6): la compra de cada semana. Se arma una vez con lo que se compra siempre y se pide de
 * un toque («Pedir mi lista»). Se guarda en la cuenta: también está en otro celular.
 */
export function Lista({ datos, productos, alPedir }: { datos: DatosDeNegocio; productos: Producto[]; alPedir: (items: ItemDeCarrito[]) => void }) {
  const { aplicar } = useInventario();
  const [agregando, setAgregando] = useState(false);
  const lista = listaVigente(datos.lista);
  const conProducto = lista.map((i) => ({ item: i, producto: productos.find((p) => p.id === i.productoId) }));
  const escalaDe = (p: Producto, presentacion: string) => escalasConPrecio(p).find((e) => e.presentacion === presentacion) ?? escalasConPrecio(p)[0];
  const total = conProducto.reduce((s, { item, producto }) => {
    const escala = producto && escalaDe(producto, item.presentacion);
    return s + (escala?.precioUnitario ? escala.precioUnitario.centavos * escala.cantidad * item.cantidad : 0);
  }, 0);

  const cambiar = (i: ItemDeLista, d: number) => {
    const t = ahora();
    const cantidad = i.cantidad + d;
    void aplicar({ lista: [cantidad <= 0 ? { ...i, eliminado: true, actualizadoEn: t } : { ...i, cantidad, actualizadoEn: t }] });
  };

  const pedir = () => {
    const items = conProducto.flatMap(({ item, producto }) => {
      const escala = producto && escalaDe(producto, item.presentacion);
      return producto && escala ? [itemDeCarrito(producto, escala, item.cantidad)] : [];
    });
    alPedir(items);
  };

  return (
    <View style={{ gap: 16 }}>
      <BotonDeAccion icono="add" titulo="Agregar a mi lista" detalle="Lo que compras todas las semanas" alTocar={() => setAgregando(true)} />
      <CabezaDeSeccion icono="list" titulo="Mi lista de la semana" subtitulo={lista.length ? `${lista.length} ${lista.length === 1 ? "producto" : "productos"} · ${bs(total)}` : undefined} />
      {conProducto.length ? (
        <>
          {conProducto.map(({ item, producto }) => {
            const { nombre, contenido } = separarContenido(producto?.nombre ?? item.productoId);
            return (
              <View key={item.id} style={ui.fila}>
                <View style={ui.foto}>{producto && <Image source={fotoDe(producto)} style={ui.imagenFila} contentFit="contain" />}</View>
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte" lineas={1}>
                    {nombre}
                  </Texto>
                  <Texto v="chico">{producto ? (contenido ?? producto.rubro) : 'Ya no se vende'}</Texto>
                </View>
                <View style={e.paso}>
                  <Tocable onPress={() => cambiar(item, -1)} style={e.botonPaso} accessibilityRole="button" accessibilityLabel={`Uno menos de ${nombre}`}>
                    <Icono nombre={item.cantidad === 1 ? 'trash-outline' : 'remove'} tamano={16} color={COLOR.bosque} />
                  </Tocable>
                  <Texto style={e.cantidad}>{item.cantidad}</Texto>
                  <Tocable onPress={() => cambiar(item, 1)} style={e.botonPaso} accessibilityRole="button" accessibilityLabel={`Uno más de ${nombre}`}>
                    <Icono nombre="add" tamano={16} color={COLOR.bosque} />
                  </Tocable>
                </View>
              </View>
            );
          })}
          <Boton texto={`Pedir mi lista · ${bs(total)}`} icono="cart" alTocar={pedir} />
        </>
      ) : (
        <View style={ui.vacio}>
          <Icono nombre="list-outline" tamano={20} color={COLOR.texto3} />
          <Texto v="gris" style={{ flex: 1 }}>
            Arma tu lista una vez (arroz, aceite, leche…) y pídela cada semana con un toque.
          </Texto>
        </View>
      )}
      <HojaParaAgregarALaLista
        visible={agregando}
        datos={datos}
        productos={productos}
        enLista={new Set(lista.map((i) => i.productoId))}
        alCerrar={() => setAgregando(false)}
        alElegir={(p) => {
          const escala = escalasConPrecio(p).find((x) => x.cantidad === 1) ?? escalasConPrecio(p)[0];
          if (escala) void aplicar({ lista: [itemDeLista(p.id, escala.presentacion, 1, ahora(), nuevoId())] });
        }}
      />
    </View>
  );
}

/** Primero lo que ya compró; con el buscador, cualquier producto de Abasto */
function HojaParaAgregarALaLista({
  visible,
  datos,
  productos,
  enLista,
  alCerrar,
  alElegir,
}: {
  visible: boolean;
  datos: DatosDeNegocio;
  productos: Producto[];
  enLista: Set<string>;
  alCerrar: () => void;
  alElegir: (p: Producto) => void;
}) {
  const [buscar, setBuscar] = useState('');
  const comprados = new Set(datos.articulos.map((a) => a.productoId).filter(Boolean));
  const filtro = buscar.trim().toLowerCase();
  const casa = productos.filter((p) => p.mayorista.deLaCasa && (p.estado === 'ACTIVO' || p.estado === 'SIN_STOCK') && escalasConPrecio(p).length);
  const opciones = (filtro ? casa.filter((p) => p.nombre.toLowerCase().includes(filtro)) : casa.filter((p) => comprados.has(p.id))).slice(0, 30);
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <ContenidoDeHoja gap={10}>
        <Texto v="t2">Agregar a mi lista</Texto>
        <View style={e.buscador}>
          <Icono nombre="search" tamano={18} color={COLOR.texto3} />
          <TextInput accessibilityLabel="Buscar productos" value={buscar} onChangeText={setBuscar} placeholder="Arroz, aceite, leche…" placeholderTextColor={COLOR.texto3} style={e.entradaBuscar} />
        </View>
        {!filtro && <Texto v="chico">{opciones.length ? 'Lo que ya compraste:' : 'Busca lo que compras siempre.'}</Texto>}
        {opciones.map((p) => {
          const ya = enLista.has(p.id);
          return (
            <Tocable key={p.id} onPress={() => !ya && alElegir(p)} style={[ui.fila, ya && { opacity: 0.55 }]} accessibilityRole="button" accessibilityLabel={`Agregar ${p.nombre}`}>
              <View style={ui.foto}>
                <Image source={fotoDe(p)} style={ui.imagenFila} contentFit="contain" />
              </View>
              <Texto style={{ flex: 1 }} lineas={2}>
                {p.nombre}
              </Texto>
              <Icono nombre={ya ? 'checkmark-circle' : 'add-circle'} tamano={26} color={COLOR.bosque} />
            </Tocable>
          );
        })}
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

const e = StyleSheet.create({
  paso: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  botonPaso: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLOR.limaMedia, alignItems: 'center', justifyContent: 'center' },
  cantidad: { minWidth: 22, textAlign: 'center', fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.texto },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 46, borderRadius: 23, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  entradaBuscar: { flex: 1, fontFamily: FUENTE.semi, fontSize: 15, color: COLOR.texto },
});
