import {
  bs,
  cantidadDe,
  datosVacios,
  estanteInicial,
  articulosDelEstante,
  insumosIniciales,
  itemsDelEstante,
  itemsParaPedir,
  leerCantidad,
  medidaDeContenido,
  numeroBonito,
  nombreDe,
  plantillasDe,
  primeraReceta,
  resumenDeEstante,
  resumenDeRecetas,
  separarContenido,
  textoDeCantidad,
  textoDeRinde,
  type CambiosDeNegocio,
  type InsumoElegido,
  type ItemDeCarrito,
  type LineaDeEstante,
  type Libro,
  type PlantillaDeReceta,
  type Producto,
  type Receta,
  type SubtipoProductor,
  type UnidadDePlantilla,
} from '@abasto/comercio';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, HojaInferior, Tocable } from '../animacion';
import { Boton, Falla, Foto, Icono, Texto } from '../componentes';
import { useEstado } from '../estado';
import { ahora, nuevoId, useInventario } from '../inventario';
import { ICONO_DE_SUBTIPO, useNegocio } from '../NegocioInicio';
import { COLOR, FUENTE, SOMBRA } from '../tema';
import { ContenidoDeHoja, Opciones, enCampo } from '../mi-negocio/ui';

/**
 * El primer paso del registro (02/11, docs/plan-catalogo-real-y-plantillas.md), después de elegir el negocio:
 * - el productor arma su primera receta desde una plantilla de su área, ya llena y editable;
 * - la tienda arma su primer estante con lo que más se repone.
 * Las dos se pueden saltar («Lo hago después»): quedan en «Mi negocio». El hogar no tiene este paso.
 */
export function PrimerPaso() {
  const { negocio, terminarPrimerPaso } = useNegocio();
  const { catalogo, agregarAlCarrito } = useEstado();
  const { datos, aplicar } = useInventario();
  const alPedir = (items: ItemDeCarrito[]) => items.forEach((i) => agregarAlCarrito(i));

  if (!catalogo.productos.length) {
    return (
      <Marco titulo="Un momento" subtitulo="Estamos trayendo el catálogo de Abasto" pie={<Boton tipo="secundario" texto="Lo hago después" alTocar={terminarPrimerPaso} />}>
        {catalogo.cargando ? <ActivityIndicator color={COLOR.bosque} size="large" /> : <Falla texto={catalogo.error ?? 'Sin señal: lo puedes hacer después en «Mi negocio»'} />}
      </Marco>
    );
  }
  if (negocio?.tipo === 'productor' && negocio.subtipo) {
    return <PrimeraReceta area={negocio.subtipo} productos={catalogo.productos} libro={datos} aplicar={aplicar} alPedir={alPedir} alTerminar={terminarPrimerPaso} />;
  }
  if (negocio?.tipo === 'tienda') {
    return <PrimerEstante productos={catalogo.productos} libro={datos} aplicar={aplicar} alPedir={alPedir} alTerminar={terminarPrimerPaso} />;
  }
  return null;
}

interface PropsDePaso {
  productos: Producto[];
  libro: Libro;
  aplicar: (cambios: CambiosDeNegocio) => Promise<void>;
  alPedir: (items: ItemDeCarrito[]) => void;
  alTerminar: () => void;
}

/** «Arma tu primera receta»: elegir qué prepara, editar la lista ya llena y ver cuánto cuesta y qué falta */
export function PrimeraReceta({ area, productos, libro, aplicar, alPedir, alTerminar }: PropsDePaso & { area: SubtipoProductor }) {
  const plantillas = plantillasDe(area);
  const varias = area === 'pension';
  const [elegidas, setElegidas] = useState<string[]>(plantillas.length === 1 ? [plantillas[0].clave] : []);
  const [paso, setPaso] = useState<'elegir' | 'editar' | 'listo'>(plantillas.length === 1 ? 'editar' : 'elegir');
  const [actual, setActual] = useState(0);
  const [hechas, setHechas] = useState<{ receta: Receta; plantilla: PlantillaDeReceta }[]>([]);
  const [libroAhora, setLibroAhora] = useState<Libro>(libro);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enEdicion = plantillas.find((p) => p.clave === elegidas[actual]);

  const alternar = (clave: string) =>
    setElegidas((e) => (varias ? (e.includes(clave) ? e.filter((c) => c !== clave) : [...e, clave]) : [clave]));

  if (paso === 'elegir') {
    return (
      <Marco
        titulo="Arma tu primera receta"
        subtitulo={varias ? '¿Qué platos haces? Marca todos los que quieras' : '¿Qué preparas más?'}
        pie={
          <>
            <Boton tipo="oscuro" texto="Seguir" icono="arrow-forward" deshabilitado={!elegidas.length} alTocar={() => setPaso('editar')} />
            <Boton tipo="secundario" texto="Lo hago después" alTocar={alTerminar} />
          </>
        }
      >
        {plantillas.map((p, i) => {
          const activo = elegidas.includes(p.clave);
          return (
            <Aparecer key={p.clave} orden={i}>
              <Tocable
                onPress={() => alternar(p.clave)}
                style={[e.opcion, activo && e.opcionActiva]}
                accessibilityRole={varias ? 'checkbox' : 'radio'}
                accessibilityState={varias ? { checked: activo } : { selected: activo }}
                accessibilityLabel={p.nombre}
              >
                <View style={e.icono}>
                  <Icono nombre={ICONO_DE_SUBTIPO[area]} tamano={22} color={COLOR.bosque} />
                </View>
                <View style={{ flex: 1 }}>
                  <Texto style={e.nombre}>{p.nombre}</Texto>
                  <Texto v="chico">{textoDeRinde(p, p.rinde)}</Texto>
                </View>
                <View style={[e.marca, activo && e.marcaActiva]}>{activo && <Icono nombre="checkmark" tamano={14} color={COLOR.lima} />}</View>
              </Tocable>
            </Aparecer>
          );
        })}
      </Marco>
    );
  }

  if (paso === 'editar' && enEdicion) {
    const guardar = async (rinde: number, insumos: InsumoElegido[]) => {
      setGuardando(true);
      try {
        const r = primeraReceta({ nombre: enEdicion.nombre, rinde, insumos }, productos, libroAhora, ahora(), nuevoId);
        await aplicar(r.cambios);
        setLibroAhora((l) => ({ ...l, articulos: [...l.articulos.filter((a) => !r.cambios.articulos.some((n) => n.id === a.id)), ...r.cambios.articulos] }));
        setHechas((h) => [...h, { receta: r.receta, plantilla: enEdicion }]);
        setError(null);
        if (actual + 1 < elegidas.length) setActual(actual + 1);
        else setPaso('listo');
      } catch (x) {
        setError(x instanceof Error ? x.message : 'No se pudo guardar');
      } finally {
        setGuardando(false);
      }
    };
    return (
      <EditorDeReceta
        key={enEdicion.clave}
        plantilla={enEdicion}
        productos={productos}
        cual={elegidas.length > 1 ? `Receta ${actual + 1} de ${elegidas.length}` : null}
        error={error}
        guardando={guardando}
        alGuardar={guardar}
        alSaltar={alTerminar}
      />
    );
  }

  return <RecetasListas hechas={hechas} libro={libroAhora} productos={productos} alPedir={alPedir} alTerminar={alTerminar} />;
}

/** La lista de la plantilla, agrupada y editable: cantidades, quitar o agregar ingredientes y cuánto rinde */
function EditorDeReceta({
  plantilla,
  productos,
  cual,
  error,
  guardando,
  alGuardar,
  alSaltar,
}: {
  plantilla: PlantillaDeReceta;
  productos: Producto[];
  cual: string | null;
  error: string | null;
  guardando: boolean;
  alGuardar: (rinde: number, insumos: InsumoElegido[]) => void;
  alSaltar: () => void;
}) {
  const [insumos, setInsumos] = useState<InsumoElegido[]>(() => insumosIniciales(plantilla, productos));
  const [textos, setTextos] = useState<string[]>(() => insumos.map((i) => enCampo(i.cantidad)));
  const [rinde, setRinde] = useState(String(plantilla.rinde));
  const [agregando, setAgregando] = useState(false);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const grupos = [...new Set(insumos.map((i) => i.grupo))];
  const rindeN = leerCantidad(rinde);

  const cambiar = (n: number, texto: string) => {
    setTextos((t) => t.map((x, i) => (i === n ? texto : x)));
    const c = leerCantidad(texto);
    if (!Number.isNaN(c)) setInsumos((l) => l.map((x, i) => (i === n ? { ...x, cantidad: c } : x)));
  };
  const quitar = (n: number) => {
    setInsumos((l) => l.filter((_, i) => i !== n));
    setTextos((t) => t.filter((_, i) => i !== n));
  };
  const agregar = (p: Producto) => {
    const { nombre, contenido } = separarContenido(p.nombre);
    const m = medidaDeContenido(contenido);
    const unidad: UnidadDePlantilla = m.unidad === 'rollos' ? 'u.' : m.unidad;
    setInsumos((l) => [...l, { clave: p.id, nombre, grupo: 'Más ingredientes', cantidad: 1, unidad, productoId: p.id, opciones: [p.id], origen: 'E' }]);
    setTextos((t) => [...t, '1']);
    setAgregando(false);
  };

  return (
    <Marco
      titulo={plantilla.nombre}
      antes={cual ?? 'Arma tu primera receta'}
      subtitulo="Ya la llenamos con una receta típica: cambia las cantidades a como lo haces tú."
      pie={
        <>
          <Boton
            tipo="oscuro"
            texto="Guardar receta"
            icono="checkmark"
            cargando={guardando}
            deshabilitado={Number.isNaN(rindeN) || rindeN <= 0}
            alTocar={() => alGuardar(rindeN, insumos)}
          />
          <Boton tipo="secundario" texto="Lo hago después" alTocar={alSaltar} />
        </>
      }
    >
      <View style={e.rinde}>
        <Texto style={e.textoRinde}>Salen</Texto>
        <TextInput accessibilityLabel="Cuántas salen" value={rinde} onChangeText={setRinde} keyboardType="decimal-pad" style={e.campoRinde} />
        <Texto style={e.textoRinde}>{plantilla.unidad.varias}</Texto>
      </View>
      {plantilla.nota && <Texto v="chico">{plantilla.nota}</Texto>}

      {grupos.map((g) => (
        <View key={g} style={e.grupo}>
          <Texto style={e.tituloGrupo}>{g}</Texto>
          {insumos.map((i, n) =>
            i.grupo !== g ? null : (
              <View key={`${i.clave}-${n}`} style={e.insumo}>
                {i.productoId && porId.get(i.productoId) ? (
                  <Foto producto={porId.get(i.productoId)!} alto={44} ancho={44} />
                ) : (
                  <View style={[e.sinFoto, i.clave === 'agua' && { backgroundColor: '#E3F1FB' }]}>
                    <Icono nombre={i.clave === 'agua' ? 'water' : 'help'} tamano={20} color={i.clave === 'agua' ? '#3B82C4' : COLOR.texto3} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte" lineas={1}>
                    {i.nombre}
                  </Texto>
                  <Texto v="chico" lineas={1}>
                    {i.clave === 'agua' ? 'No se compra' : i.productoId ? (separarContenido(porId.get(i.productoId)?.nombre ?? '').contenido ?? 'De Abasto') : 'Ya no lo vendemos'}
                  </Texto>
                </View>
                <TextInput
                  accessibilityLabel={`Cantidad de ${i.nombre}`}
                  value={textos[n]}
                  onChangeText={(t) => cambiar(n, t)}
                  keyboardType="decimal-pad"
                  style={e.campoCantidad}
                  selectTextOnFocus
                />
                <Texto style={e.unidad}>{i.unidad}</Texto>
                <Tocable onPress={() => quitar(n)} style={e.quitar} accessibilityRole="button" accessibilityLabel={`Quitar ${i.nombre}`}>
                  <Icono nombre="close" tamano={16} color={COLOR.texto3} />
                </Tocable>
              </View>
            ),
          )}
        </View>
      ))}
      <Tocable onPress={() => setAgregando(true)} style={e.agregar} accessibilityRole="button" accessibilityLabel="Agregar ingrediente">
        <Icono nombre="add" tamano={18} color={COLOR.bosque} />
        <Texto v="fuerte">Agregar ingrediente</Texto>
      </Tocable>
      <Texto v="chico" style={{ textAlign: 'center' }}>
        Son cantidades de referencia, no una fórmula probada. Ajústalas cuando quieras en «Mi negocio».
      </Texto>
      {error && <Falla texto={error} />}
      <HojaParaAgregarIngrediente visible={agregando} productos={productos} alCerrar={() => setAgregando(false)} alElegir={agregar} />
    </Marco>
  );
}

/** Buscar en el catálogo de Abasto un ingrediente que no venía en la plantilla */
function HojaParaAgregarIngrediente({ visible, productos, alCerrar, alElegir }: { visible: boolean; productos: Producto[]; alCerrar: () => void; alElegir: (p: Producto) => void }) {
  const [texto, setTexto] = useState('');
  const t = texto.trim().toLowerCase();
  const lista = productos.filter((p) => !t || p.nombre.toLowerCase().includes(t)).slice(0, 30);
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <ContenidoDeHoja gap={8}>
        <Texto v="t2">Agregar ingrediente</Texto>
        <TextInput accessibilityLabel="Buscar ingrediente" value={texto} onChangeText={setTexto} placeholder="Busca: queso, carne, leche…" placeholderTextColor={COLOR.texto3} style={e.buscar} />
        {lista.map((p) => (
          <Tocable key={p.id} onPress={() => alElegir(p)} style={e.fila} accessibilityRole="button" accessibilityLabel={`Agregar ${p.nombre}`}>
            <Foto producto={p} alto={40} ancho={40} />
            <Texto style={{ flex: 1 }} lineas={2}>
              {p.nombre}
            </Texto>
            <Icono nombre="add-circle" tamano={22} color={COLOR.bosque} />
          </Tocable>
        ))}
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

/** Lo que gana con su receta: cuánto le cuesta cada unidad y qué le falta, con un botón para pedirlo */
function RecetasListas({
  hechas,
  libro,
  productos,
  alPedir,
  alTerminar,
}: {
  hechas: { receta: Receta; plantilla: PlantillaDeReceta }[];
  libro: Libro;
  productos: Producto[];
  alPedir: (items: ItemDeCarrito[]) => void;
  alTerminar: () => void;
}) {
  const resumen = useMemo(() => resumenDeRecetas(hechas.map((h) => h.receta), libro, productos), [hechas, libro, productos]);
  const { items } = useMemo(() => itemsParaPedir(resumen.faltantes, productos), [resumen, productos]);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const total = items.reduce((s, i) => s + (i.precioUnitarioCentavos ?? 0) * i.unidadesPorPresentacion * i.cantidad, 0);

  return (
    <Marco
      titulo={hechas.length > 1 ? '¡Tus recetas están listas!' : '¡Tu receta está lista!'}
      subtitulo="Con los precios de Abasto de hoy. Cuando compres, se calcula con lo que pagaste."
      pie={
        <>
          {items.length > 0 && (
            <Boton
              tipo="oscuro"
              texto={`Pedir lo que falta · ${bs(total)}`}
              icono="cart"
              alTocar={() => {
                alPedir(items);
                alTerminar();
              }}
            />
          )}
          <Boton tipo="secundario" texto={items.length ? 'Ahora no' : 'Seguir'} alTocar={alTerminar} />
        </>
      }
    >
      {resumen.costos.map((c, i) => {
        const p = hechas[i].plantilla;
        return (
          <Aparecer key={c.receta.id} orden={i}>
            <View style={e.costo}>
              <Texto style={e.textoCosto}>Cada {p.unidad.una} te cuesta</Texto>
              <Texto style={e.cifraCosto}>{bs(c.porUnidadCentavos)}</Texto>
              <Texto style={e.detalleCosto}>
                {c.receta.nombre} · {textoDeRinde(p, c.receta.rinde).toLowerCase()} por {bs(c.totalCentavos)}
              </Texto>
            </View>
          </Aparecer>
        );
      })}
      {items.length > 0 && (
        <View style={e.grupo}>
          <Texto style={e.tituloGrupo}>{hechas.length > 1 ? 'Para estas recetas te falta esto' : 'Para esta receta te falta esto'}</Texto>
          {items.map((i) => (
            <View key={`${i.productoId}-${i.presentacion}`} style={e.insumo}>
              {porId.get(i.productoId) && <Foto producto={porId.get(i.productoId)!} alto={44} ancho={44} />}
              <Texto style={{ flex: 1 }} lineas={2}>
                {i.nombre}
              </Texto>
              <Texto v="fuerte" style={{ maxWidth: 120, textAlign: 'right' }}>
                {cuantoPedir(i, porId.get(i.productoId))}
              </Texto>
            </View>
          ))}
        </View>
      )}
    </Marco>
  );
}

/** «1 arroba · 11,5 kg», «2 u. · 2 kg», «1 docena»: lo que va al carrito, con su unidad */
function cuantoPedir(i: ItemDeCarrito, p: Producto | undefined) {
  if (i.presentacion !== 'UNIDAD') return cantidadDe(i.presentacion, i.cantidad);
  const m = medidaDeContenido(separarContenido(p?.nombre ?? i.nombre).contenido);
  // «Charque · 1 kg» × 2 → «2 kg» (no «2 u. · 2 kg»)
  if (m.envase === 'unidad' && m.porEnvase === 1 && m.unidad !== 'u.') return `${numeroBonito(i.cantidad)} ${m.unidad}`;
  return textoDeCantidad(i.cantidad, m);
}

const GANANCIAS = [
  { clave: '0.15', texto: '15 %' },
  { clave: '0.2', texto: '20 %' },
  { clave: '0.25', texto: '25 %' },
  { clave: '0.3', texto: '30 %' },
];

/** «Arma tu primer estante»: lo que más se repone, ya marcado; quita lo que no vende y ve cuánto gana */
export function PrimerEstante({ productos, libro, aplicar, alPedir, alTerminar }: PropsDePaso) {
  const [estante, setEstante] = useState<LineaDeEstante[]>(() => estanteInicial(productos));
  const [margen, setMargen] = useState('0.2');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = resumenDeEstante(estante, Number(margen));
  const cambiar = (n: number, cambio: Partial<LineaDeEstante>) => setEstante((l) => l.map((x, i) => (i === n ? { ...x, ...cambio } : x)));

  const pedir = async () => {
    setGuardando(true);
    try {
      // Quedan en el inventario en cero, con su precio de venta: al llegar el pedido ya están listos para vender
      await aplicar({ articulos: articulosDelEstante(estante, Number(margen), libro ?? datosVacios(), ahora()) });
      alPedir(itemsDelEstante(estante));
      alTerminar();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo guardar');
      setGuardando(false);
    }
  };

  return (
    <Marco
      titulo="Arma tu primer estante"
      subtitulo="Lo que más se vende en una tienda de barrio. Quita lo que no vendes y dinos cuántos quieres."
      pie={
        <>
          <Boton tipo="oscuro" texto={`Pedir este estante · ${bs(r.costoCentavos)}`} icono="cart" cargando={guardando} deshabilitado={!r.lineas} alTocar={() => void pedir()} />
          <Boton tipo="secundario" texto="Lo hago después" alTocar={alTerminar} />
        </>
      }
    >
      <View style={e.costo}>
        <Texto style={e.textoCosto}>Si lo vendes al precio sugerido, ganas</Texto>
        <Texto style={e.cifraCosto}>{bs(r.gananciaCentavos)}</Texto>
        <Texto style={e.detalleCosto}>
          Inviertes {bs(r.costoCentavos)} y vendes {bs(r.ventaCentavos)}
        </Texto>
      </View>
      <View style={{ gap: 6 }}>
        <Texto v="fuerte">¿Cuánto le quieres ganar?</Texto>
        <Opciones opciones={GANANCIAS} elegida={margen} alElegir={setMargen} />
      </View>
      {estante.map((l, n) => (
        <View key={l.producto.id} style={[e.insumo, !l.marcado && { opacity: 0.55 }]}>
          <Tocable
            onPress={() => cambiar(n, { marcado: !l.marcado })}
            style={[e.marca, l.marcado && e.marcaActiva]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: l.marcado }}
            accessibilityLabel={l.producto.nombre}
          >
            {l.marcado && <Icono nombre="checkmark" tamano={14} color={COLOR.lima} />}
          </Tocable>
          <Foto producto={l.producto} alto={44} ancho={44} />
          <View style={{ flex: 1 }}>
            <Texto v="fuerte" lineas={1}>
              {l.producto.nombre}
            </Texto>
            <Texto v="chico">
              {l.escala.precioUnitario?.texto} c/u · {l.escala.cantidad === 1 ? 'por unidad' : `${nombreDe(l.escala.presentacion)} de ${l.escala.cantidad}`}
            </Texto>
          </View>
          <View style={e.paso}>
            <Tocable onPress={() => cambiar(n, { cantidad: Math.max(1, l.cantidad - 1) })} style={e.botonPaso} accessibilityRole="button" accessibilityLabel={`Menos ${l.producto.nombre}`}>
              <Icono nombre="remove" tamano={16} color={COLOR.bosque} />
            </Tocable>
            <Texto style={e.numeroPaso}>{l.cantidad}</Texto>
            <Tocable onPress={() => cambiar(n, { cantidad: l.cantidad + 1, marcado: true })} style={[e.botonPaso, { backgroundColor: COLOR.lima }]} accessibilityRole="button" accessibilityLabel={`Más ${l.producto.nombre}`}>
              <Icono nombre="add" tamano={16} color={COLOR.bosque} />
            </Tocable>
          </View>
        </View>
      ))}
      {error && <Falla texto={error} />}
    </Marco>
  );
}

/** El fondo, el título y los botones de abajo de cada paso, como en «¿Para qué compras?» */
function Marco({ titulo, antes, subtitulo, pie, children }: { titulo: string; antes?: string; subtitulo: string; pie: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#DDF4A0', '#EEF8D5', COLOR.fondo]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
          <Aparecer style={{ gap: 4 }}>
            {antes && <Texto style={e.antes}>{antes}</Texto>}
            <Texto style={e.titulo}>{titulo}</Texto>
            <Texto v="gris">{subtitulo}</Texto>
          </Aparecer>
          {children}
        </ScrollView>
        <View style={e.pie}>{pie}</View>
      </SafeAreaView>
    </View>
  );
}

const e = StyleSheet.create({
  contenido: { padding: 20, paddingTop: 24, gap: 12, paddingBottom: 24 },
  antes: { fontFamily: FUENTE.fuerte, fontSize: 14, color: COLOR.bosqueMedio },
  titulo: { fontFamily: FUENTE.negra, fontSize: 26, lineHeight: 31, color: COLOR.texto, letterSpacing: -0.8 },
  pie: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 8 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: COLOR.superficie, borderWidth: 2, borderColor: 'transparent', ...SOMBRA },
  opcionActiva: { borderColor: COLOR.bosque, backgroundColor: COLOR.limaSuave },
  icono: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  nombre: { fontFamily: FUENTE.negra, fontSize: 17, color: COLOR.texto, letterSpacing: -0.3 },
  marca: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLOR.borde, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.superficie },
  marcaActiva: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  rinde: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 20, backgroundColor: COLOR.bosque },
  textoRinde: { fontFamily: FUENTE.negra, fontSize: 18, color: '#fff' },
  campoRinde: { minWidth: 72, height: 46, paddingHorizontal: 10, borderRadius: 14, backgroundColor: COLOR.lima, fontFamily: FUENTE.negra, fontSize: 22, color: COLOR.bosque, textAlign: 'center' },
  grupo: { gap: 8, padding: 12, borderRadius: 22, backgroundColor: COLOR.superficie, ...SOMBRA },
  tituloGrupo: { fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.bosque },
  insumo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  sinFoto: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLOR.tenue, alignItems: 'center', justifyContent: 'center' },
  campoCantidad: { width: 64, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.fondo, textAlign: 'center', fontFamily: FUENTE.fuerte, fontSize: 15, color: COLOR.texto },
  unidad: { width: 24, fontFamily: FUENTE.semi, fontSize: 13, color: COLOR.texto2 },
  quitar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.tenue },
  agregar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 16, borderWidth: 1.5, borderColor: COLOR.bosque, borderStyle: 'dashed' },
  buscar: { height: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLOR.borde, fontFamily: FUENTE.semi, fontSize: 15, color: COLOR.texto },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  costo: { alignItems: 'center', gap: 2, padding: 18, borderRadius: 24, backgroundColor: COLOR.bosque },
  textoCosto: { fontFamily: FUENTE.fuerte, fontSize: 15, color: COLOR.lima },
  cifraCosto: { fontFamily: FUENTE.negra, fontSize: 40, color: '#fff', letterSpacing: -1.2 },
  detalleCosto: { fontFamily: FUENTE.semi, fontSize: 13, color: '#CFE3D6', textAlign: 'center' },
  paso: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  botonPaso: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.tenue },
  numeroPaso: { minWidth: 18, textAlign: 'center', fontFamily: FUENTE.negra, fontSize: 15, color: COLOR.texto },
});
