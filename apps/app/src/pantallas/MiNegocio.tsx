import {
  MIS_COMPRAS,
  TIPOS,
  bs,
  cuentasDelMes,
  existencias,
  inventarioDelNegocio,
  itemsParaPedir,
  mesDe,
  reporteDelMes,
  resumenDelInventario,
  type Faltante,
  type ItemDeCarrito,
  type NegocioElegido,
  type Pedido,
  type TipoDeNegocio,
} from '@abasto/comercio';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { graphql } from '../api';
import { Tocable } from '../animacion';
import { useEspacioBarra } from '../BarraInferior';
import { Icono, Texto, type NombreDeIcono } from '../componentes';
import { useEstado } from '../estado';
import { guardado } from '../guardado';
import { ahora, useInventario, type EstadoDeLaNube } from '../inventario';
import { Caja } from '../mi-negocio/Caja';
import { Cuentas } from '../mi-negocio/Cuentas';
import { ElMes } from '../mi-negocio/ElMes';
import { Fiado } from '../mi-negocio/Fiado';
import { HojaDeArticulo, HojaParaAgregar, VistaDeInventario } from '../mi-negocio/Inventario';
import { Lista } from '../mi-negocio/Lista';
import { Recetas } from '../mi-negocio/Recetas';
import { Segmentos, imagenDeArticulo } from '../mi-negocio/ui';
import type { PantallaDePestana } from '../navegacion';
import { IMAGEN_DE_NEGOCIO, useNegocio } from '../NegocioInicio';
import { CABECERA, COLOR, FUENTE } from '../tema';
import { AvisoSinSenal } from './Inicio';

export type ClaveDeSeccion = 'inventario' | 'recetas' | 'vender' | 'fiado' | 'mes' | 'cuentas' | 'despensa' | 'lista';

/** Las secciones de cada tipo, en el orden en que se usan */
export const SECCIONES: Record<TipoDeNegocio, { clave: ClaveDeSeccion; texto: string; icono: NombreDeIcono }[]> = {
  tienda: [
    { clave: 'inventario', texto: 'Inventario', icono: 'cube' },
    { clave: 'vender', texto: 'Vender', icono: 'cash' },
    { clave: 'fiado', texto: 'Fiado', icono: 'book' },
    { clave: 'mes', texto: 'El mes', icono: 'stats-chart' },
  ],
  productor: [
    { clave: 'inventario', texto: 'Inventario', icono: 'cube' },
    { clave: 'recetas', texto: 'Recetas', icono: 'restaurant' },
    { clave: 'vender', texto: 'Vender', icono: 'cash' },
    { clave: 'fiado', texto: 'Fiado', icono: 'book' },
    { clave: 'mes', texto: 'El mes', icono: 'stats-chart' },
  ],
  hogar: [
    { clave: 'cuentas', texto: 'Cuentas', icono: 'wallet' },
    { clave: 'despensa', texto: 'Despensa', icono: 'basket' },
    { clave: 'lista', texto: 'Mi lista', icono: 'list' },
  ],
};

/**
 * «Mi casa», «Mi tienda» o «Mi producción» (docs/plan-mi-negocio.md). Todo se guarda en la cuenta del cliente (base de
 * datos del servidor); el teléfono guarda una copia para andar sin señal y sube lo pendiente solo.
 * - Tienda: Inventario (se llena solo), Vender (caja rápida), Fiado (cuaderno) y El mes.
 * - Productor: lo mismo más Recetas (costo por unidad, planificador y tandas).
 * - Hogar: Cuentas del mes, Despensa (con «se te acaba») y Mi lista de la semana.
 */
export function MiNegocio({ navigation }: PantallaDePestana<'MiNegocio'>) {
  const negocio: NegocioElegido = useNegocio().negocio ?? { tipo: 'tienda' };
  const inventario = useInventario();
  const { datos, cargando, sincronizar, sincronizarAhora, agregarAMano } = inventario;
  const { enLinea, catalogo, agregarAlCarrito, avisar } = useEstado();
  const enFoco = useIsFocused();
  const arriba = useSafeAreaInsets().top;
  const espacio = useEspacioBarra();
  const secciones = SECCIONES[negocio.tipo];
  const [seccion, setSeccion] = useState<ClaveDeSeccion>(secciones[0].clave);
  const [actualizando, setActualizando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  // Si cambia el tipo (desde Cuenta), se vuelve a su primera sección
  useEffect(() => {
    if (!secciones.some((s) => s.clave === seccion)) setSeccion(secciones[0].clave);
  }, [secciones, seccion]);

  /** Los pedidos (del servidor con señal; los guardados sin señal): lo entregado entra solo y sirve para el ahorro */
  const actualizar = useCallback(async () => {
    const guardados = await guardado.leer<Pedido[]>('pedidos');
    if (guardados) {
      setPedidos(guardados);
      await sincronizar(guardados);
    }
    if (!enLinea) return;
    try {
      const d = await graphql<{ misCompras: Pedido[] }>(MIS_COMPRAS);
      setPedidos(d.misCompras);
      await guardado.escribir('pedidos', d.misCompras);
      await sincronizar(d.misCompras);
    } catch {
      // Sin servidor: queda lo guardado
    }
  }, [enLinea, sincronizar]);

  useEffect(() => {
    if (enFoco) void actualizar();
  }, [enFoco, actualizar]);

  const productos = useMemo(() => new Map(catalogo.productos.map((p) => [p.id, p])), [catalogo.productos]);
  const nombreDe = (articuloId: string) => datos.articulos.find((a) => a.id === articuloId)?.nombre ?? 'Un producto';
  const existencia = abierta ? (existencias(datos).find((x) => x.articulo.id === abierta) ?? null) : null;

  const alCarrito = (items: ItemDeCarrito[], noSeVenden: string[] = []) => {
    if (!items.length) {
      avisar(noSeVenden.length ? `Ya no vendemos: ${noSeVenden.join(', ')}` : 'No hay nada para pedir');
      return;
    }
    items.forEach(agregarAlCarrito);
    avisar(`Agregamos ${items.length} ${items.length === 1 ? 'producto' : 'productos'} al carrito${noSeVenden.length ? ` (ya no vendemos: ${noSeVenden.join(', ')})` : ''}`);
    navigation.navigate('Carrito');
  };
  const alPedir = (faltantes: Faltante[]) => {
    const r = itemsParaPedir(faltantes, catalogo.productos, (id) => productos.get(id)?.nombre ?? id);
    alCarrito(r.items, r.noSeVenden);
  };

  const resumen = useMemo(() => {
    if (negocio.tipo === 'hogar') {
      const c = cuentasDelMes(datos.anotaciones, mesDe(ahora()));
      if (!c.ingresosCentavos && !c.gastosCentavos) return 'Tu despensa y tus cuentas, en un solo lugar.';
      return c.quedanCentavos >= 0 ? `Te quedan ${bs(c.quedanCentavos)} este mes` : `Este mes gastaste ${bs(-c.quedanCentavos)} más de lo que entró`;
    }
    const r = reporteDelMes(datos, mesDe(ahora()));
    if (r.ventas) return `Este mes vendiste ${bs(r.ventasCentavos)} y ganaste ${bs(r.gananciaBrutaCentavos)}`;
    return resumenDelInventario(negocio, inventarioDelNegocio(negocio, datos)) ?? 'Lo que compras en Abasto entra aquí solo.';
  }, [negocio, datos]);

  const inventarioVista = (
    <VistaDeInventario
      negocio={negocio}
      datos={datos}
      cargando={cargando}
      imagenDe={(a) => imagenDeArticulo(a, productos)}
      alAbrir={(x) => setAbierta(x.articulo.id)}
      alAgregar={() => setAgregando(true)}
      alComprar={() => navigation.navigate('Inicio')}
      alPedir={alPedir}
    />
  );

  return (
    <View style={e.pantalla}>
      {enFoco && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: espacio }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={async () => {
              setActualizando(true);
              await actualizar();
              await sincronizarAhora();
              setActualizando(false);
            }}
            tintColor={COLOR.lima}
            colors={[COLOR.bosque]}
          />
        }
      >
        <LinearGradient colors={[CABECERA.oscuro, CABECERA.claro]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[e.cabecera, { paddingTop: arriba + 18 }]}>
          <View style={e.textosCabecera}>
            <Texto style={e.titulo} lineas={1}>
              {TIPOS[negocio.tipo].pestana}
            </Texto>
            <Texto style={e.resumen}>{resumen}</Texto>
            <Nube estado={inventario.nube} porSubir={inventario.porSubir} alReintentar={() => void sincronizarAhora()} />
          </View>
          <Image source={IMAGEN_DE_NEGOCIO[negocio.tipo]} style={e.imagenCabecera} contentFit="contain" accessibilityIgnoresInvertColors />
        </LinearGradient>

        {!enLinea && <AvisoSinSenal />}

        <View style={{ marginTop: 16 }}>
          <Segmentos opciones={secciones} elegida={seccion} alElegir={setSeccion} />
        </View>

        <View style={e.cuerpo}>
          {(seccion === 'inventario' || seccion === 'despensa') && inventarioVista}
          {seccion === 'vender' && <Caja negocio={negocio} datos={datos} imagenDe={(x) => imagenDeArticulo(x.articulo, productos)} alVendido={avisar} />}
          {seccion === 'fiado' && <Fiado datos={datos} />}
          {seccion === 'mes' && <ElMes datos={datos} nombreDe={nombreDe} />}
          {seccion === 'recetas' && <Recetas negocio={negocio} datos={datos} alPedir={alPedir} />}
          {seccion === 'cuentas' && <Cuentas datos={datos} pedidos={pedidos} productos={catalogo.productos} />}
          {seccion === 'lista' && <Lista datos={datos} productos={catalogo.productos} alPedir={(items) => alCarrito(items)} />}
        </View>
      </ScrollView>

      <HojaDeArticulo
        negocio={negocio}
        existencia={existencia}
        imagen={existencia ? imagenDeArticulo(existencia.articulo, productos) : null}
        alCerrar={() => setAbierta(null)}
        alPedir={(productoId) => {
          setAbierta(null);
          navigation.navigate('Producto', { id: productoId });
        }}
      />
      <HojaParaAgregar visible={agregando} alCerrar={() => setAgregando(false)} alAgregar={agregarAMano} />
    </View>
  );
}

const TEXTO_DE_LA_NUBE: Record<EstadoDeLaNube, { icono: NombreDeIcono; texto: (n: number) => string }> = {
  'al-dia': { icono: 'cloud-done', texto: () => 'Guardado en tu cuenta' },
  'por-subir': { icono: 'cloud-upload', texto: (n) => `Guardando ${n} ${n === 1 ? 'cambio' : 'cambios'}…` },
  subiendo: { icono: 'cloud-upload', texto: () => 'Guardando…' },
  'sin-senal': { icono: 'cloud-offline', texto: (n) => (n ? `${n} ${n === 1 ? 'cambio' : 'cambios'} se suben con señal` : 'Sin señal: se guarda al volver') },
  error: { icono: 'refresh', texto: (n) => (n ? `${n} sin subir · toca para reintentar` : 'No se pudo actualizar · reintentar') },
};

/** Dónde está lo de la persona: guardado en su cuenta o esperando señal */
export function Nube({ estado, porSubir, alReintentar }: { estado: EstadoDeLaNube; porSubir: number; alReintentar: () => void }) {
  const t = TEXTO_DE_LA_NUBE[estado];
  return (
    <Tocable onPress={alReintentar} style={[e.pildora, estado === 'error' && { backgroundColor: COLOR.ambar }]} accessibilityRole="button" accessibilityLabel={t.texto(porSubir)}>
      <Icono nombre={t.icono} tamano={14} color={COLOR.bosque} />
      <Texto style={e.textoPildora}>{t.texto(porSubir)}</Texto>
    </Tocable>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  cabecera: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, minHeight: 190 },
  textosCabecera: { flex: 1, gap: 6, paddingBottom: 4 },
  titulo: { fontFamily: FUENTE.negra, fontSize: 30, color: '#FFFFFF', letterSpacing: -0.8 },
  resumen: { fontFamily: FUENTE.semi, fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.85)' },
  pildora: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: COLOR.lima, marginTop: 4 },
  textoPildora: { fontFamily: FUENTE.fuerte, fontSize: 12, color: COLOR.bosque },
  imagenCabecera: { width: 130, height: 150, marginBottom: -30, marginRight: -6 },
  cuerpo: { padding: 16, gap: 18, paddingTop: 16 },
});
