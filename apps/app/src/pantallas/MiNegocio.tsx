import {
  MEDIDAS_A_MANO,
  MIS_COMPRAS,
  TIPOS,
  bs,
  equivalencia,
  inventarioDelNegocio,
  leerCantidad,
  plural,
  resumenDelInventario,
  tinte,
  type Articulo,
  type Existencia,
  type GrupoDeInventario,
  type Medida,
  type NegocioElegido,
  type Pedido,
  type Producto,
} from '@abasto/comercio';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { graphql } from '../api';
import { Aparecer, HojaInferior, Tocable } from '../animacion';
import { useEspacioBarra } from '../BarraInferior';
import { Boton, Falla, Icono, Texto, type NombreDeIcono } from '../componentes';
import { useEstado } from '../estado';
import { guardado } from '../guardado';
import { ILUSTRACION, fotoDe, imagenDeRubro, type Imagen } from '../ilustraciones';
import { useInventario } from '../inventario';
import type { PantallaDePestana } from '../navegacion';
import { IMAGEN_DE_NEGOCIO, useNegocio } from '../NegocioInicio';
import { CABECERA, COLOR, FUENTE, SOMBRA, TINTES } from '../tema';
import { AvisoSinSenal } from './Inicio';

/**
 * «Mi casa», «Mi tienda» o «Mi producción» (Fase 2 de docs/plan-mi-negocio.md): el inventario que se llena solo con lo
 * que se compra en Abasto. Al abrir la pestaña se leen los pedidos (con señal, del servidor; sin señal, los guardados) y
 * lo ENTREGADO entra sin duplicarse. Lo de otros proveedores se agrega a mano y lo que hay se corrige contándolo.
 * El productor ve insumos y lo que hace por separado (lo hecho se llena con los lotes de la Fase 4).
 */
export function MiNegocio({ navigation }: PantallaDePestana<'MiNegocio'>) {
  const negocio = useNegocio().negocio ?? { tipo: 'tienda' as const };
  const { datos, cargando, sincronizar, agregarAMano, sumar, ajustar } = useInventario();
  const { enLinea, catalogo } = useEstado();
  const enFoco = useIsFocused();
  const [actualizando, setActualizando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);

  const actualizar = useCallback(async () => {
    const guardados = await guardado.leer<Pedido[]>('pedidos');
    if (guardados) await sincronizar(guardados);
    if (!enLinea) return;
    try {
      const d = await graphql<{ misCompras: Pedido[] }>(MIS_COMPRAS);
      await guardado.escribir('pedidos', d.misCompras);
      await sincronizar(d.misCompras);
    } catch {
      // Sin servidor: queda lo guardado
    }
  }, [enLinea, sincronizar]);

  useEffect(() => {
    if (enFoco) void actualizar();
  }, [enFoco, actualizar]);

  const grupos = useMemo(() => inventarioDelNegocio(negocio, datos), [negocio, datos]);
  const productos = useMemo(() => new Map(catalogo.productos.map((p) => [p.id, p])), [catalogo.productos]);
  const existencia = abierta ? grupos.flatMap((g) => g.lineas).find((l) => l.articulo.id === abierta) ?? null : null;

  return (
    <>
      <VistaDeInventario
        negocio={negocio}
        grupos={grupos}
        cargando={cargando}
        enLinea={enLinea}
        actualizando={actualizando}
        imagenDe={(a) => imagenDeArticulo(a, productos)}
        alActualizar={async () => {
          setActualizando(true);
          await actualizar();
          setActualizando(false);
        }}
        alAbrir={(e) => setAbierta(e.articulo.id)}
        alAgregar={() => setAgregando(true)}
        alComprar={() => navigation.navigate('Inicio')}
      />
      <HojaDeArticulo
        existencia={existencia}
        imagen={existencia ? imagenDeArticulo(existencia.articulo, productos) : null}
        alCerrar={() => setAbierta(null)}
        alAjustar={ajustar}
        alSumar={sumar}
        alPedir={(productoId) => {
          setAbierta(null);
          navigation.navigate('Producto', { id: productoId });
        }}
      />
      <HojaParaAgregar visible={agregando} alCerrar={() => setAgregando(false)} alAgregar={agregarAMano} />
    </>
  );
}

function imagenDeArticulo(a: Articulo, productos: Map<string, Producto>): Imagen {
  const p = a.productoId ? productos.get(a.productoId) : undefined;
  if (p) return fotoDe(p);
  return a.rubro ? imagenDeRubro(a.rubro) : ILUSTRACION.inventarioVacio;
}

const ICONO_DE_GRUPO: Record<GrupoDeInventario['clave'], NombreDeIcono> = { despensa: 'basket', para_vender: 'storefront', insumos: 'flask', hechos: 'restaurant' };

export interface PropsDeVista {
  negocio: NegocioElegido;
  grupos: GrupoDeInventario[];
  cargando: boolean;
  enLinea: boolean;
  actualizando: boolean;
  imagenDe: (a: Articulo) => Imagen;
  alActualizar: () => void;
  alAbrir: (e: Existencia) => void;
  alAgregar: () => void;
  alComprar: () => void;
}

/** La pestaña sin estado propio: la usan la pantalla y las pruebas */
export function VistaDeInventario({ negocio, grupos, cargando, enLinea, actualizando, imagenDe, alActualizar, alAbrir, alAgregar, alComprar }: PropsDeVista) {
  const arriba = useSafeAreaInsets().top;
  const espacio = useEspacioBarra();
  const enFoco = useIsFocused();
  const resumen = resumenDelInventario(negocio, grupos);
  const sinNada = !cargando && grupos.every((g) => !g.lineas.length);

  return (
    <View style={e.pantalla}>
      {enFoco && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: espacio }}
        refreshControl={<RefreshControl refreshing={actualizando} onRefresh={alActualizar} tintColor={COLOR.lima} colors={[COLOR.bosque]} />}
      >
        <LinearGradient colors={[CABECERA.oscuro, CABECERA.claro]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[e.cabecera, { paddingTop: arriba + 18 }]}>
          <View style={e.textosCabecera}>
            <Texto style={e.titulo} lineas={1}>
              {TIPOS[negocio.tipo].pestana}
            </Texto>
            <Texto style={e.resumen}>{resumen ?? 'Lo que compras en Abasto entra aquí solo.'}</Texto>
            <View style={e.pildora}>
              <Icono nombre="flash" tamano={13} color={COLOR.bosque} />
              <Texto style={e.textoPildora}>Se llena solo</Texto>
            </View>
          </View>
          <Image source={IMAGEN_DE_NEGOCIO[negocio.tipo]} style={e.imagenCabecera} contentFit="contain" accessibilityIgnoresInvertColors />
        </LinearGradient>

        {!enLinea && <AvisoSinSenal />}

        <View style={e.cuerpo}>
          {sinNada ? (
            <Aparecer>
              <View style={e.vacio}>
                <Image source={ILUSTRACION.inventarioVacio} style={e.imagenVacio} contentFit="contain" accessibilityIgnoresInvertColors />
                <Texto style={e.tituloVacio}>Todavía no hay nada</Texto>
                <Texto v="gris" style={{ textAlign: 'center' }}>
                  {grupos[0]?.vacio}
                </Texto>
                <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 6 }}>
                  <Boton texto="Ir a comprar" icono="cart" alTocar={alComprar} />
                  <Boton tipo="secundario" texto="Agregar a mano" icono="add" alTocar={alAgregar} />
                </View>
              </View>
            </Aparecer>
          ) : (
            <>
              <Tocable onPress={alAgregar} style={e.agregar} accessibilityRole="button" accessibilityLabel="Agregar a mano">
                <View style={e.iconoAgregar}>
                  <Icono nombre="add" tamano={20} color={COLOR.lima} />
                </View>
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte">Agregar a mano</Texto>
                  <Texto v="chico">Lo que compras a otro proveedor</Texto>
                </View>
                <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
              </Tocable>
              {grupos.map((g, i) => (
                <Aparecer key={g.clave} orden={1 + i} style={{ gap: 10 }}>
                  <View style={e.cabezaGrupo}>
                    <View style={e.iconoGrupo}>
                      <Icono nombre={ICONO_DE_GRUPO[g.clave]} tamano={18} color={COLOR.bosque} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Texto style={e.tituloGrupo}>{g.titulo}</Texto>
                      <Texto v="gris">{g.subtitulo}</Texto>
                    </View>
                    {g.valorCentavos > 0 && <Texto style={e.valorGrupo}>{bs(g.valorCentavos)}</Texto>}
                  </View>
                  {g.lineas.length ? (
                    g.lineas.map((l) => <FilaDeArticulo key={l.articulo.id} existencia={l} imagen={imagenDe(l.articulo)} alTocar={() => alAbrir(l)} />)
                  ) : (
                    <View style={e.grupoVacio}>
                      <Icono nombre="time-outline" tamano={20} color={COLOR.texto3} />
                      <Texto v="gris" style={{ flex: 1 }}>
                        {g.vacio}
                      </Texto>
                    </View>
                  )}
                </Aparecer>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function FilaDeArticulo({ existencia: x, imagen, alTocar }: { existencia: Existencia; imagen: Imagen; alTocar: () => void }) {
  const a = x.articulo;
  return (
    <Tocable onPress={alTocar} style={[e.fila, x.agotado && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${a.nombre}: ${x.agotado ? 'agotado' : x.texto}`}>
      <View style={[e.foto, { backgroundColor: a.rubro ? TINTES[tinte(a.rubro)] : COLOR.limaSuave }]}>
        <Image source={imagen} style={e.imagenFila} contentFit="contain" />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Texto v="fuerte" lineas={1}>
          {a.nombre}
        </Texto>
        <Texto v="chico" lineas={1}>
          {[a.detalle, a.origen === 'ABASTO' ? 'De Abasto' : (a.proveedor ?? 'Otro proveedor')].filter(Boolean).join(' · ')}
        </Texto>
        <View style={[e.cantidad, x.agotado && e.cantidadAgotada]}>
          <Texto style={[e.textoCantidad, x.agotado && { color: COLOR.texto3 }]} lineas={1}>
            {x.agotado ? 'Agotado' : x.texto}
          </Texto>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {x.valorCentavos !== null && !x.agotado && <Texto v="chico">{bs(x.valorCentavos)}</Texto>}
        <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
      </View>
    </Tocable>
  );
}

/**
 * Las hojas van en un Modal y ahí KeyboardAvoidingView no las sube: se mide el teclado y el contenido sube esa
 * misma altura, con el alto máximo recortado para que el botón siga a la vista.
 */
function useTeclado() {
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (ev: KeyboardEvent) => setAlto(ev.endCoordinates.height));
    const ocultar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setAlto(0));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return alto;
}

function ContenidoDeHoja({ children, gap }: { children: React.ReactNode; gap: number }) {
  const teclado = useTeclado();
  const { height } = useWindowDimensions();
  return (
    <View style={{ paddingBottom: teclado }}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.min(640, height - teclado - 140) }} contentContainerStyle={{ gap }}>
        {children}
      </ScrollView>
    </View>
  );
}

const fecha = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** «2», «1,5»: el número que se muestra en el campo */
const enCampo = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

/** La ficha de un artículo: cuánto hay, cuánto costó y corregir lo contado. Si es de Abasto, volver a pedirlo */
export function HojaDeArticulo({
  existencia: x,
  imagen,
  alCerrar,
  alAjustar,
  alSumar,
  alPedir,
}: {
  existencia: Existencia | null;
  imagen: Imagen | null;
  alCerrar: () => void;
  alAjustar: (x: Existencia, contada: number) => Promise<boolean>;
  alSumar: (a: Articulo, cantidad: number, costo: number | null) => Promise<void>;
  alPedir: (productoId: string) => void;
}) {
  const [contada, setContada] = useState('');
  const [compra, setCompra] = useState('');
  const [precio, setPrecio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  useEffect(() => {
    setContada(x ? enCampo(Math.max(x.cantidad, 0)) : '');
    setCompra('');
    setPrecio('');
    setError(null);
    setListo(null);
    // Solo al abrir otro artículo, no cada vez que cambia su cantidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x?.articulo.id]);

  if (!x) return <HojaInferior visible={false}>{null}</HojaInferior>;
  const a = x.articulo;
  const envases = (n: number) => (a.medida.envase === 'unidad' ? 'u.' : ['kg', 'L'].includes(a.medida.envase) ? a.medida.envase : plural(a.medida.envase, n));
  const valorContado = leerCantidad(contada);
  const paso = (d: number) => setContada(enCampo(Math.max(0, (Number.isNaN(valorContado) ? 0 : valorContado) + d)));

  const guardarConteo = async () => {
    setError(null);
    if (Number.isNaN(valorContado)) return setError('Escribe cuánto tienes, por ejemplo 2 o 1,5');
    const cambio = await alAjustar(x, valorContado);
    setListo(cambio ? 'Guardamos lo que tienes' : 'No cambió nada');
  };
  const guardarCompra = async () => {
    setError(null);
    const n = leerCantidad(compra);
    const p = precio.trim() ? leerCantidad(precio) : null;
    if (Number.isNaN(n) || n <= 0) return setError('Escribe cuánto compraste');
    if (p !== null && Number.isNaN(p)) return setError('Revisa el precio');
    await alSumar(a, n, p === null ? null : Math.round(p * 100));
    setCompra('');
    setPrecio('');
    setListo('Sumamos tu compra');
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <ContenidoDeHoja gap={14}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {imagen !== null && (
              <View style={[e.foto, { width: 64, height: 64 }]}>
                <Image source={imagen} style={e.imagenFila} contentFit="contain" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Texto v="t2" lineas={2}>
                {a.nombre}
              </Texto>
              <Texto v="gris">{[a.detalle, a.origen === 'ABASTO' ? 'Entra solo con tus pedidos de Abasto' : (a.proveedor ?? 'Otro proveedor')].filter(Boolean).join(' · ')}</Texto>
            </View>
          </View>

          <View style={e.cuadro}>
            <Texto v="chico">Tienes</Texto>
            <Texto style={e.cuantoHay}>{x.agotado ? 'Agotado' : x.texto}</Texto>
            {equivalencia(a.medida) && <Texto v="chico">{equivalencia(a.medida)}</Texto>}
            {x.costoPromedioCentavos !== null && (
              <Texto v="gris">
                Te costó {bs(x.costoPromedioCentavos)} por {a.medida.envase === 'unidad' ? 'unidad' : a.medida.envase} en promedio
                {x.valorCentavos ? ` · vale ${bs(x.valorCentavos)}` : ''}
              </Texto>
            )}
            {x.ultimaEntrada && <Texto v="chico">Última compra: {fecha(x.ultimaEntrada)}</Texto>}
          </View>

          <View style={{ gap: 8 }}>
            <Texto v="fuerte">¿Cuánto tienes ahora?</Texto>
            <View style={e.paso}>
              <Tocable onPress={() => paso(-1)} style={e.botonPaso} accessibilityRole="button" accessibilityLabel="Uno menos">
                <Icono nombre="remove" tamano={22} color={COLOR.bosque} />
              </Tocable>
              <View style={e.campoPaso}>
                <TextInput
                  accessibilityLabel="Cuánto tienes ahora"
                  value={contada}
                  onChangeText={(t) => {
                    setContada(t);
                    setListo(null);
                  }}
                  keyboardType="decimal-pad"
                  style={e.entradaPaso}
                />
                <Texto v="gris">{envases(Number.isNaN(valorContado) ? 2 : valorContado)}</Texto>
              </View>
              <Tocable onPress={() => paso(1)} style={e.botonPaso} accessibilityRole="button" accessibilityLabel="Uno más">
                <Icono nombre="add" tamano={22} color={COLOR.bosque} />
              </Tocable>
            </View>
            <Boton tipo="oscuro" texto="Guardar lo que tengo" icono="checkmark" alTocar={() => void guardarConteo()} />
          </View>

          {a.origen === 'OTRO_PROVEEDOR' && (
            <View style={{ gap: 8 }}>
              <Texto v="fuerte">Sumar una compra</Texto>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Campo etiqueta={`¿Cuántos ${envases(2)}?`} valor={compra} alCambiar={setCompra} teclado="decimal-pad" estilo={{ flex: 1 }} />
                <Campo etiqueta={`Bs por ${a.medida.envase === 'unidad' ? 'unidad' : a.medida.envase}`} valor={precio} alCambiar={setPrecio} teclado="decimal-pad" estilo={{ flex: 1 }} />
              </View>
              <Boton tipo="secundario" texto="Sumar compra" icono="add" alTocar={() => void guardarCompra()} />
            </View>
          )}

          {error && <Falla texto={error} />}
          {listo && (
            <View style={e.listo} accessibilityRole="alert">
              <Icono nombre="checkmark-circle" tamano={18} color={COLOR.bosque} />
              <Texto v="fuerte">{listo}</Texto>
            </View>
          )}
          {a.productoId && <Boton tipo="secundario" texto="Volver a pedir" icono="repeat" alTocar={() => alPedir(a.productoId!)} />}
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

/** Agregar a mano lo que se compra a otro proveedor */
export function HojaParaAgregar({
  visible,
  alCerrar,
  alAgregar,
}: {
  visible: boolean;
  alCerrar: () => void;
  alAgregar: (entrada: { nombre: string; medida: Medida; proveedor?: string | null }, cantidad: number, costo: number | null) => Promise<unknown>;
}) {
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('unidad');
  const [cantidad, setCantidad] = useState('');
  const [precio, setPrecio] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const medida = MEDIDAS_A_MANO.find((m) => m.clave === clave)!;
  const envase = medida.medida.envase === 'unidad' ? 'unidad' : medida.medida.envase;

  const limpiar = () => {
    setNombre('');
    setClave('unidad');
    setCantidad('');
    setPrecio('');
    setProveedor('');
    setError(null);
  };

  const agregar = async () => {
    setError(null);
    const n = leerCantidad(cantidad);
    const p = precio.trim() ? leerCantidad(precio) : null;
    if (nombre.trim().length < 2) return setError('Escribe el nombre del producto');
    if (Number.isNaN(n) || n <= 0) return setError('Escribe cuánto compraste');
    if (p !== null && Number.isNaN(p)) return setError('Revisa el precio');
    setOcupado(true);
    try {
      await alAgregar({ nombre, medida: medida.medida, proveedor }, n, p === null ? null : Math.round(p * 100));
      limpiar();
      alCerrar();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo agregar');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <ContenidoDeHoja gap={12}>
          <View style={{ gap: 2 }}>
            <Texto v="t2">Agregar a mano</Texto>
            <Texto v="gris">Lo que compras a otro proveedor. Lo de Abasto entra solo.</Texto>
          </View>
          <Campo etiqueta="¿Qué es?" valor={nombre} alCambiar={setNombre} ejemplo="Queso menonita" mayusculas />
          <View style={{ gap: 6 }}>
            <Texto v="fuerte">¿En qué lo cuentas?</Texto>
            <View style={e.medidas}>
              {MEDIDAS_A_MANO.map((m) => {
                const activo = m.clave === clave;
                return (
                  <Tocable
                    key={m.clave}
                    onPress={() => setClave(m.clave)}
                    style={[e.medida, activo && e.medidaActiva]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: activo }}
                    accessibilityLabel={m.texto}
                  >
                    <Texto style={[e.textoMedida, activo && { color: COLOR.lima }]}>{m.texto}</Texto>
                  </Tocable>
                );
              })}
            </View>
            {equivalencia(medida.medida) && <Texto v="chico">{equivalencia(medida.medida)}</Texto>}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Campo etiqueta="¿Cuánto compraste?" valor={cantidad} alCambiar={setCantidad} teclado="decimal-pad" ejemplo="2" estilo={{ flex: 1 }} />
            <Campo etiqueta={`Bs por ${envase} (opcional)`} valor={precio} alCambiar={setPrecio} teclado="decimal-pad" ejemplo="0,00" estilo={{ flex: 1 }} />
          </View>
          <Campo etiqueta="¿A quién? (opcional)" valor={proveedor} alCambiar={setProveedor} ejemplo="Feria, otro mayorista…" mayusculas />
          {error && <Falla texto={error} />}
          <Boton texto="Agregar" icono="add" cargando={ocupado} alTocar={() => void agregar()} />
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

function Campo({
  etiqueta,
  valor,
  alCambiar,
  ejemplo,
  teclado = 'default',
  mayusculas,
  estilo,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (t: string) => void;
  ejemplo?: string;
  teclado?: 'default' | 'decimal-pad';
  mayusculas?: boolean;
  estilo?: object;
}) {
  return (
    <View style={[{ gap: 4 }, estilo]}>
      <Texto v="chico">{etiqueta}</Texto>
      <TextInput
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={alCambiar}
        placeholder={ejemplo}
        placeholderTextColor={COLOR.texto3}
        keyboardType={teclado}
        autoCapitalize={mayusculas ? 'sentences' : 'none'}
        style={e.campo}
      />
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  cabecera: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, minHeight: 190 },
  textosCabecera: { flex: 1, gap: 6, paddingBottom: 4 },
  titulo: { fontFamily: FUENTE.negra, fontSize: 30, color: '#FFFFFF', letterSpacing: -0.8 },
  resumen: { fontFamily: FUENTE.semi, fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.85)' },
  pildora: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: COLOR.lima, marginTop: 4 },
  textoPildora: { fontFamily: FUENTE.fuerte, fontSize: 12, color: COLOR.bosque },
  imagenCabecera: { width: 130, height: 150, marginBottom: -30, marginRight: -6 },
  cuerpo: { padding: 16, gap: 18, paddingTop: 22 },
  vacio: { alignItems: 'center', gap: 8, padding: 20, borderRadius: 26, backgroundColor: COLOR.superficie, ...SOMBRA },
  imagenVacio: { width: 200, height: 200 },
  tituloVacio: { fontFamily: FUENTE.negra, fontSize: 20, color: COLOR.texto, letterSpacing: -0.4 },
  agregar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  iconoAgregar: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLOR.bosque, alignItems: 'center', justifyContent: 'center' },
  cabezaGrupo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconoGrupo: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-10deg' }] },
  tituloGrupo: { fontFamily: FUENTE.negra, fontSize: 19, color: COLOR.texto, letterSpacing: -0.5 },
  valorGrupo: { fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.bosque },
  grupoVacio: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: COLOR.tenue, borderWidth: 1, borderColor: COLOR.borde, borderStyle: 'dashed' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, backgroundColor: COLOR.superficie, ...SOMBRA },
  foto: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: COLOR.limaSuave },
  imagenFila: { width: '84%', height: '84%' },
  cantidad: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: COLOR.limaMedia },
  cantidadAgotada: { backgroundColor: COLOR.tenue },
  textoCantidad: { fontFamily: FUENTE.negra, fontSize: 13.5, color: COLOR.bosque },
  cuadro: { gap: 4, padding: 14, borderRadius: 18, backgroundColor: COLOR.limaSuave },
  cuantoHay: { fontFamily: FUENTE.negra, fontSize: 24, color: COLOR.bosque, letterSpacing: -0.6 },
  paso: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botonPaso: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLOR.limaMedia, alignItems: 'center', justifyContent: 'center' },
  campoPaso: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie },
  entradaPaso: { minWidth: 50, textAlign: 'center', fontFamily: FUENTE.negra, fontSize: 20, color: COLOR.texto },
  listo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, backgroundColor: COLOR.limaMedia },
  medidas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  medida: { paddingHorizontal: 14, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  medidaActiva: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  textoMedida: { fontFamily: FUENTE.fuerte, fontSize: 13, color: COLOR.bosque },
  campo: { height: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie, fontFamily: FUENTE.semi, fontSize: 16, color: COLOR.texto },
});
