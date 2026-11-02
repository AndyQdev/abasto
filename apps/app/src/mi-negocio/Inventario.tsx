import {
  MEDIDAS_A_MANO,
  avisoDeStock,
  bs,
  conMinimo,
  conPrecio,
  equivalencia,
  inventarioDelNegocio,
  leerCantidad,
  margenDe,
  plural,
  precioDeVenta,
  seTeAcaba,
  seVende,
  tinte,
  type Articulo,
  type Existencia,
  type Faltante,
  type GrupoDeInventario,
  type Libro,
  type Medida,
  type NegocioElegido,
} from '@abasto/comercio';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';
import { Aparecer, HojaInferior, Tocable, vibrar } from '../animacion';
import { Boton, Falla, Icono, Texto, type NombreDeIcono } from '../componentes';
import { ILUSTRACION, type Imagen } from '../ilustraciones';
import { ahora, useInventario } from '../inventario';
import { COLOR, FUENTE, SOMBRA, TINTES } from '../tema';
import { Campo, CabezaDeSeccion, ContenidoDeHoja, enCampo, bsEnCampo, fecha, Listo, Opciones, leerBs, ui } from './ui';

const ICONO_DE_GRUPO: Record<GrupoDeInventario['clave'], NombreDeIcono> = { despensa: 'basket', para_vender: 'storefront', insumos: 'flask', hechos: 'restaurant' };

export interface PropsDeInventario {
  negocio: NegocioElegido;
  datos: Libro;
  cargando: boolean;
  imagenDe: (a: Articulo) => Imagen;
  alAbrir: (x: Existencia) => void;
  alAgregar: () => void;
  alComprar: () => void;
  /** «Pedir de nuevo» lo que queda poco (o lo que se acaba en la casa) */
  alPedir: (faltantes: Faltante[]) => void;
  /** Mostrar un solo grupo (el productor elige entre insumos y lo que hace) */
  grupo?: GrupoDeInventario['clave'];
  /** Tienda: «Arma tu primer estante» con lo que más se repone (el del registro, si lo saltó) */
  alArmarEstante?: () => void;
  /** Productos (id de Catálogo) que acaban de llegar con una compra: van arriba y resaltados (02/11) */
  recien?: string[];
}

/** El inventario (o la despensa del hogar), agrupado como lo ve cada tipo. Sin estado propio: lo usan la pantalla y las pruebas */
export function VistaDeInventario({ negocio, datos, cargando, imagenDe, alAbrir, alAgregar, alComprar, alPedir, grupo, alArmarEstante, recien = [] }: PropsDeInventario) {
  const esRecien = (a: Articulo) => !!a.productoId && recien.includes(a.productoId);
  const grupos = useMemo(
    () =>
      inventarioDelNegocio(negocio, datos)
        .filter((g) => !grupo || g.clave === grupo)
        // Lo que acaba de llegar, primero
        .map((g) => (recien.length ? { ...g, lineas: [...g.lineas].sort((a, b) => Number(recien.includes(b.articulo.productoId ?? '')) - Number(recien.includes(a.articulo.productoId ?? ''))) } : g)),
    [negocio, datos, grupo, recien],
  );
  const sinNada = !cargando && grupos.every((g) => !g.lineas.length);
  const hoy = ahora();

  if (sinNada) {
    return (
      <Aparecer>
        <View style={e.vacio}>
          <Image source={ILUSTRACION.inventarioVacio} style={e.imagenVacio} contentFit="contain" accessibilityIgnoresInvertColors />
          <Texto style={e.tituloVacio}>Todavía no hay nada</Texto>
          <Texto v="gris" style={{ textAlign: 'center' }}>
            {grupos[0]?.vacio}
          </Texto>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 6 }}>
            {alArmarEstante && <Boton tipo="oscuro" texto="Arma tu primer estante" icono="sparkles" alTocar={alArmarEstante} />}
            <Boton texto="Ir a comprar" icono="cart" alTocar={alComprar} />
            <Boton tipo="secundario" texto="Agregar a mano" icono="add" alTocar={alAgregar} />
          </View>
        </View>
      </Aparecer>
    );
  }

  // Lo que pide reposición: queda poco (tienda, productor) o se acaba en una semana (hogar)
  const paraPedir = grupos
    .flatMap((g) => g.lineas)
    .filter((x) => x.articulo.productoId && x.articulo.clase === 'COMPRADO')
    .filter((x) => (negocio.tipo === 'hogar' ? (seTeAcaba(x, datos.movimientos, hoy) ?? 99) <= 7 : avisoDeStock(x, datos) !== null));

  return (
    <View style={{ gap: 18 }}>
      {paraPedir.length > 0 && (
        <Aparecer>
          <View style={e.reponer}>
            <Icono nombre="alert-circle" tamano={22} color={COLOR.ambarTexto} />
            <View style={{ flex: 1 }}>
              <Texto v="fuerte" style={{ color: COLOR.ambarTexto }}>
                {paraPedir.length === 1 ? `Se te acaba ${paraPedir[0].articulo.nombre}` : `Se te acaban ${paraPedir.length} productos`}
              </Texto>
              <Texto style={{ color: COLOR.ambarTexto, fontSize: 12.5 }}>Pídelos ahora y te llegan sin ir al mercado.</Texto>
            </View>
            <Tocable
              onPress={() => alPedir(paraPedir.map((x) => ({ productoId: x.articulo.productoId!, envases: ultimaCompra(x, datos) })))}
              style={e.botonReponer}
              accessibilityRole="button"
              accessibilityLabel="Pedir de nuevo"
            >
              <Texto style={e.textoReponer}>Pedir</Texto>
            </Tocable>
          </View>
        </Aparecer>
      )}
      {grupos.map((g, i) => (
        <Aparecer key={g.clave} orden={1 + i} style={{ gap: 10 }}>
          <CabezaDeSeccion icono={ICONO_DE_GRUPO[g.clave]} titulo={g.titulo} subtitulo={g.subtitulo} derecha={g.valorCentavos > 0 ? <Texto style={e.valorGrupo}>{bs(g.valorCentavos)}</Texto> : undefined} />
          {g.lineas.length ? (
            g.lineas.map((l, i) =>
              esRecien(l.articulo) ? (
                <RecienLlegado key={l.articulo.id} orden={i}>
                  <FilaDeArticulo negocio={negocio} datos={datos} existencia={l} imagen={imagenDe(l.articulo)} alTocar={() => alAbrir(l)} />
                </RecienLlegado>
              ) : (
                <FilaDeArticulo key={l.articulo.id} negocio={negocio} datos={datos} existencia={l} imagen={imagenDe(l.articulo)} alTocar={() => alAbrir(l)} />
              ),
            )
          ) : (
            <View style={ui.vacio}>
              <Icono nombre="time-outline" tamano={20} color={COLOR.texto3} />
              <Texto v="gris" style={{ flex: 1 }}>
                {g.vacio}
              </Texto>
            </View>
          )}
        </Aparecer>
      ))}
    </View>
  );
}

/** Lo que acaba de llegar: cae en su lugar con un rebote, se marca en lima y late un rato */
function RecienLlegado({ children, orden }: { children: ReactNode; orden: number }) {
  const cae = useRef(new Animated.Value(0)).current;
  const late = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    vibrar.toque();
    Animated.sequence([
      Animated.delay(250 + orden * 160),
      Animated.spring(cae, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 14 }),
    ]).start();
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(late, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(late, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
      { iterations: 5 },
    );
    bucle.start();
    return () => bucle.stop();
  }, [cae, late, orden]);
  return (
    <Animated.View
      style={{
        opacity: cae,
        transform: [{ translateY: cae.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }, { scale: cae.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }}
    >
      <Animated.View pointerEvents="none" style={[e.resplandor, { opacity: late.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />
      {children}
      <View pointerEvents="none" style={e.etiquetaRecien}>
        <Icono nombre="sparkles" tamano={12} color={COLOR.bosque} />
        <Texto style={e.textoRecien}>Recién llegó</Texto>
      </View>
    </Animated.View>
  );
}

/** Cuánto se pidió la última vez (para «pedir de nuevo» lo mismo) */
function ultimaCompra(x: Existencia, datos: Libro) {
  const entradas = datos.movimientos.filter((m) => m.articuloId === x.articulo.id && m.tipo === 'ENTRADA' && m.cantidad > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return entradas.length ? entradas[entradas.length - 1].cantidad : 1;
}

function FilaDeArticulo({ negocio, datos, existencia: x, imagen, alTocar }: { negocio: NegocioElegido; datos: Libro; existencia: Existencia; imagen: Imagen; alTocar: () => void }) {
  const a = x.articulo;
  const precio = seVende(negocio, a) ? precioDeVenta(x, negocio) : null;
  const aviso = avisoDeStock(x, datos);
  const dias = negocio.tipo === 'hogar' ? seTeAcaba(x, datos.movimientos, ahora()) : null;
  return (
    <Tocable onPress={alTocar} style={[ui.fila, x.agotado && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${a.nombre}: ${x.porComprar ? 'por comprar' : x.agotado ? 'agotado' : x.texto}`}>
      <View style={[ui.foto, { width: 64, height: 64, backgroundColor: a.rubro ? TINTES[tinte(a.rubro)] : COLOR.limaSuave }]}>
        <Image source={imagen} style={ui.imagenFila} contentFit="contain" />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Texto v="fuerte" lineas={1}>
          {a.nombre}
        </Texto>
        <Texto v="chico" lineas={1}>
          {[a.detalle, a.origen === 'ABASTO' ? 'De Abasto' : (a.proveedor ?? 'Otro proveedor')].filter(Boolean).join(' · ')}
        </Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <View style={[ui.pildora, x.agotado && e.agotado]}>
            <Texto style={[ui.textoPildora, x.agotado && { color: COLOR.texto3 }]} lineas={1}>
              {x.porComprar ? 'Por comprar' : x.agotado ? 'Agotado' : x.texto}
            </Texto>
          </View>
          {aviso === 'poco' && (
            <View style={[ui.pildora, e.poco]}>
              <Texto style={[ui.textoPildora, { color: COLOR.ambarTexto }]}>Queda poco</Texto>
            </View>
          )}
          {dias !== null && !x.agotado && (
            <View style={[ui.pildora, dias <= 7 ? e.poco : e.neutro]}>
              <Texto style={[ui.textoPildora, { color: dias <= 7 ? COLOR.ambarTexto : COLOR.texto2 }]}>Se acaba en ~{dias} {dias === 1 ? 'día' : 'días'}</Texto>
            </View>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {precio ? (
          <>
            <Texto style={e.precio}>{bs(precio.centavos)}</Texto>
            {precio.gananciaCentavos !== null && <Texto style={e.ganancia}>gana {bs(precio.gananciaCentavos)}</Texto>}
          </>
        ) : (
          x.valorCentavos !== null && !x.agotado && <Texto v="chico">{bs(x.valorCentavos)}</Texto>
        )}
        <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
      </View>
    </Tocable>
  );
}

/**
 * La ficha de un artículo: cuánto hay y cuánto costó; corregir lo contado; sumar una compra (si es de otro proveedor);
 * para quien vende, el precio de venta y desde cuándo avisar «queda poco». Si es de Abasto, volver a pedirlo.
 */
export function HojaDeArticulo({
  negocio,
  existencia: x,
  imagen,
  alCerrar,
  alPedir,
}: {
  negocio: NegocioElegido;
  existencia: Existencia | null;
  imagen: Imagen | null;
  alCerrar: () => void;
  alPedir: (productoId: string) => void;
}) {
  const { ajustar, sumar, aplicar } = useInventario();
  const [contada, setContada] = useState('');
  const [compra, setCompra] = useState('');
  const [costo, setCosto] = useState('');
  const [precio, setPrecio] = useState('');
  const [minimo, setMinimo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  useEffect(() => {
    setContada(x ? enCampo(Math.max(x.cantidad, 0)) : '');
    setCompra('');
    setCosto('');
    setPrecio(x?.articulo.precioVentaCentavos != null ? bsEnCampo(x.articulo.precioVentaCentavos) : '');
    setMinimo(x?.articulo.stockMinimo != null ? enCampo(x.articulo.stockMinimo) : '');
    setError(null);
    setListo(null);
    // Solo al abrir otro artículo, no cada vez que cambia su cantidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x?.articulo.id]);

  if (!x) return <HojaInferior visible={false}>{null}</HojaInferior>;
  const a = x.articulo;
  const vende = seVende(negocio, a);
  const sugerido = precioDeVenta({ ...x, articulo: { ...a, precioVentaCentavos: null } }, negocio);
  const envases = (n: number) => (a.medida.envase === 'unidad' ? 'u.' : ['kg', 'L'].includes(a.medida.envase) ? a.medida.envase : plural(a.medida.envase, n));
  const porEnvase = a.medida.envase === 'unidad' ? 'unidad' : a.medida.envase;
  const valorContado = leerCantidad(contada);
  const paso = (d: number) => setContada(enCampo(Math.max(0, (Number.isNaN(valorContado) ? 0 : valorContado) + d)));
  const hecho = (texto: string) => {
    setError(null);
    setListo(texto);
  };

  const guardarConteo = async () => {
    if (Number.isNaN(valorContado)) return setError('Escribe cuánto tienes, por ejemplo 2 o 1,5');
    hecho((await ajustar(x, valorContado)) ? 'Guardamos lo que tienes' : 'No cambió nada');
  };
  const guardarCompra = async () => {
    const n = leerCantidad(compra);
    const c = costo.trim() ? leerBs(costo) : null;
    if (Number.isNaN(n) || n <= 0) return setError('Escribe cuánto compraste');
    if (c !== null && Number.isNaN(c)) return setError('Revisa el precio');
    await sumar(a, n, c);
    setCompra('');
    setCosto('');
    hecho('Sumamos tu compra');
  };
  const guardarPrecio = async () => {
    const p = precio.trim() ? leerBs(precio) : null;
    const m = minimo.trim() ? leerCantidad(minimo) : null;
    if (p !== null && Number.isNaN(p)) return setError('Revisa el precio, por ejemplo 13,50');
    if (m !== null && Number.isNaN(m)) return setError('Revisa la cantidad para avisar');
    const t = ahora();
    await aplicar({ articulos: [conMinimo(conPrecio(a, p, t), m, t)] });
    hecho('Guardamos el precio');
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <ContenidoDeHoja gap={14}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {imagen !== null && (
            <View style={[ui.foto, { width: 64, height: 64 }]}>
              <Image source={imagen} style={ui.imagenFila} contentFit="contain" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Texto v="t2" lineas={2}>
              {a.nombre}
            </Texto>
            <Texto v="gris">{[a.detalle, a.origen === 'ABASTO' ? 'Entra solo con tus compras en Abasto' : (a.proveedor ?? 'Otro proveedor')].filter(Boolean).join(' · ')}</Texto>
          </View>
        </View>

        <View style={e.cuadro}>
          <Texto v="chico">Tienes</Texto>
          <Texto style={e.cuantoHay}>{x.porComprar ? 'Por comprar' : x.agotado ? 'Agotado' : x.texto}</Texto>
          {equivalencia(a.medida) && <Texto v="chico">{equivalencia(a.medida)}</Texto>}
          {x.costoPromedioCentavos !== null && (
            <Texto v="gris">
              Te costó {bs(x.costoPromedioCentavos)} por {porEnvase} en promedio
              {x.valorCentavos ? ` · vale ${bs(x.valorCentavos)}` : ''}
            </Texto>
          )}
          {x.ultimaEntrada && <Texto v="chico">Última compra: {fecha(x.ultimaEntrada)}</Texto>}
        </View>

        {vende && (
          <View style={{ gap: 8 }}>
            <Texto v="fuerte">¿A cuánto lo vendes?</Texto>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Campo etiqueta={`Bs por ${porEnvase}`} valor={precio} alCambiar={setPrecio} teclado="decimal-pad" ejemplo={sugerido ? bsEnCampo(sugerido.centavos) : '0,00'} estilo={{ flex: 1 }} />
              <Campo etiqueta={`Avisar si quedan (${envases(2)})`} valor={minimo} alCambiar={setMinimo} teclado="decimal-pad" ejemplo="Se estima" estilo={{ flex: 1 }} />
            </View>
            {sugerido && (
              <Texto v="chico">
                Sugerido: {bs(sugerido.centavos)} (tu costo + {Math.round(margenDe(negocio) * 100)} %). Si lo dejas vacío, se usa el sugerido.
              </Texto>
            )}
            <Boton tipo="secundario" texto="Guardar precio" icono="pricetag" alTocar={() => void guardarPrecio()} />
          </View>
        )}

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

        {a.origen === 'OTRO_PROVEEDOR' && a.clase === 'COMPRADO' && (
          <View style={{ gap: 8 }}>
            <Texto v="fuerte">Sumar una compra</Texto>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Campo etiqueta={`¿Cuántos ${envases(2)}?`} valor={compra} alCambiar={setCompra} teclado="decimal-pad" estilo={{ flex: 1 }} />
              <Campo etiqueta={`Bs por ${porEnvase}`} valor={costo} alCambiar={setCosto} teclado="decimal-pad" estilo={{ flex: 1 }} />
            </View>
            <Boton tipo="secundario" texto="Sumar compra" icono="add" alTocar={() => void guardarCompra()} />
          </View>
        )}

        {error && <Falla texto={error} />}
        {listo && <Listo texto={listo} />}
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

  const agregar = async () => {
    setError(null);
    const n = leerCantidad(cantidad);
    const p = precio.trim() ? leerBs(precio) : null;
    if (nombre.trim().length < 2) return setError('Escribe el nombre del producto');
    if (Number.isNaN(n) || n <= 0) return setError('Escribe cuánto compraste');
    if (p !== null && Number.isNaN(p)) return setError('Revisa el precio');
    setOcupado(true);
    try {
      await alAgregar({ nombre, medida: medida.medida, proveedor }, n, p);
      setNombre('');
      setClave('unidad');
      setCantidad('');
      setPrecio('');
      setProveedor('');
      alCerrar();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo agregar');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <ContenidoDeHoja>
        <View style={{ gap: 2 }}>
          <Texto v="t2">Agregar a mano</Texto>
          <Texto v="gris">Lo que compras a otro proveedor. Lo de Abasto entra solo.</Texto>
        </View>
        <Campo etiqueta="¿Qué es?" valor={nombre} alCambiar={setNombre} ejemplo="Queso menonita" mayusculas />
        <View style={{ gap: 6 }}>
          <Texto v="fuerte">¿En qué lo cuentas?</Texto>
          <Opciones opciones={MEDIDAS_A_MANO.map((m) => ({ clave: m.clave, texto: m.texto }))} elegida={clave} alElegir={setClave} />
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

const e = StyleSheet.create({
  resplandor: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 24, borderWidth: 3, borderColor: COLOR.lima, backgroundColor: COLOR.limaSuave },
  etiquetaRecien: { position: 'absolute', top: -9, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: COLOR.lima, borderWidth: 1.5, borderColor: COLOR.bosque },
  textoRecien: { fontFamily: FUENTE.negra, fontSize: 11, color: COLOR.bosque },
  vacio: { alignItems: 'center', gap: 8, padding: 20, borderRadius: 26, backgroundColor: COLOR.superficie, ...SOMBRA },
  imagenVacio: { width: 140, height: 140 },
  tituloVacio: { fontFamily: FUENTE.negra, fontSize: 20, color: COLOR.texto, letterSpacing: -0.4 },
  valorGrupo: { fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.bosque },
  reponer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: COLOR.ambarSuave },
  botonReponer: { paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: COLOR.bosque, alignItems: 'center', justifyContent: 'center' },
  textoReponer: { fontFamily: FUENTE.fuerte, fontSize: 14, color: COLOR.lima },
  agotado: { backgroundColor: COLOR.tenue },
  poco: { backgroundColor: COLOR.ambarSuave },
  neutro: { backgroundColor: COLOR.tenue },
  precio: { fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.bosque },
  ganancia: { fontFamily: FUENTE.semi, fontSize: 11.5, color: COLOR.limaTexto },
  cuadro: { gap: 4, padding: 14, borderRadius: 18, backgroundColor: COLOR.limaSuave },
  cuantoHay: { fontFamily: FUENTE.negra, fontSize: 24, color: COLOR.bosque, letterSpacing: -0.6 },
  paso: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botonPaso: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLOR.limaMedia, alignItems: 'center', justifyContent: 'center' },
  campoPaso: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie },
  entradaPaso: { minWidth: 50, textAlign: 'center', fontFamily: FUENTE.negra, fontSize: 20, color: COLOR.texto },
});
