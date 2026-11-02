import {
  articuloHecho,
  bs,
  conPrecio,
  costoDeReceta,
  existencias,
  leerCantidad,
  margenDe,
  numeroBonito,
  planificar,
  plantillasDe,
  precioSugerido,
  receta as armarReceta,
  registrarTanda,
  SUBTIPOS_DE_PRODUCTOR,
  textoDeReceta,
  unidadDeReceta,
  type DatosDeNegocio,
  type Faltante,
  type NegocioElegido,
  type Plan,
  type PrecioDeReferencia,
  type Receta,
  type SubtipoProductor,
} from '@abasto/comercio';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Aparecer, HojaInferior, Tocable } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { ILUSTRACION } from '../ilustraciones';
import { ahora, nuevoId, useInventario } from '../inventario';
import { COLOR, FUENTE, SOMBRA } from '../tema';
import { Campo, ContenidoDeHoja, Contador, Opciones, Pasos, bsEnCampo, leerBs, ui } from './ui';

/**
 * «Mi producción» rediseñada (02/11, pedido del usuario: «súper entendible, cada paso»). Lo que hace el productor y su
 * receta van juntos en una tarjeta: cuántas tiene listas, cuánto le cuesta cada una, a cuánto la vende y cuánto gana.
 * - «Hacer una tanda» es un paso a paso: 1 ¿Cuántas? (con lo que tiene y lo que falta) → 2 ¿Cuántas salieron? → 3 Listo.
 * - «Nueva receta» también: 1 ¿Qué haces? → 2 ¿Cuántas salen? → 3 ¿Qué lleva? (con el costo en vivo).
 */

/** Cómo se llama lo que hace cada productor: «Mis salteñas», «Mis panes», «Mis platos» */
const LO_HECHO: Record<SubtipoProductor, { plural: string; titulo: string; una: string }> = {
  salteneria: { plural: 'salteñas', titulo: 'Mis salteñas', una: 'cada salteña' },
  panaderia: { plural: 'panes', titulo: 'Mis panes', una: 'cada pan' },
  horneados: { plural: 'horneados', titulo: 'Mis horneados', una: 'cada uno' },
  pension: { plural: 'platos', titulo: 'Mis platos', una: 'cada plato' },
  polleria: { plural: 'porciones', titulo: 'Lo que vendo', una: 'cada porción' },
  puesto: { plural: 'porciones', titulo: 'Lo que vendo', una: 'cada porción' },
};

export function nombreDeLoHecho(n: NegocioElegido) {
  return LO_HECHO[(n.subtipo as SubtipoProductor | undefined) ?? 'salteneria'] ?? LO_HECHO.salteneria;
}

/** Los nombres que se ofrecen al crear una receta: los de las plantillas de su área */
const SUGERENCIAS: Record<string, string[]> = Object.fromEntries(
  SUBTIPOS_DE_PRODUCTOR.map((a) => [a, plantillasDe(a).map((p) => p.nombre)]),
);

export function Produccion({
  negocio,
  datos,
  nuevo,
  alPedir,
  alVender,
  alUsarPlantilla,
  referencia,
}: {
  negocio: NegocioElegido;
  datos: DatosDeNegocio;
  /** Sube cuando se toca el botón flotante: abre «Nueva receta» */
  nuevo: number;
  alPedir: (faltantes: Faltante[]) => void;
  alVender: () => void;
  /** Arma una receta desde una plantilla de su área (la del registro, si la saltó) */
  alUsarPlantilla?: () => void;
  /** El precio del catálogo de lo que todavía no compró: el costo sale aunque el insumo esté en cero */
  referencia?: PrecioDeReferencia;
}) {
  const [creando, setCreando] = useState<Receta | 'nueva' | null>(null);
  const [tanda, setTanda] = useState<string | null>(null);
  const [verReceta, setVerReceta] = useState<string | null>(null);
  useEffect(() => {
    if (nuevo > 0) setCreando('nueva');
  }, [nuevo]);
  const recetas = datos.recetas.filter((r) => !r.eliminado);
  const hay = useMemo(() => new Map(existencias(datos).map((x) => [x.articulo.id, x])), [datos]);
  const lo = nombreDeLoHecho(negocio);
  const insumos = existencias(datos).filter((x) => x.articulo.clase === 'COMPRADO');

  return (
    <View style={{ gap: 14 }}>
      {recetas.length === 0 ? (
        <Aparecer>
          <View style={e.bienvenida}>
            <Image source={ILUSTRACION.negocioProductor} style={e.imagenBienvenida} contentFit="contain" accessibilityIgnoresInvertColors />
            <Texto style={e.tituloBienvenida}>Agrega lo que haces</Texto>
            <Texto v="gris" style={{ textAlign: 'center' }}>
              Anota tu receta una sola vez y te decimos cuánto te cuesta {lo.una}, qué te falta comprar y cuánto ganas.
            </Texto>
            <View style={e.comoFunciona}>
              {[
                { icono: 'create' as const, texto: 'Anota tu receta' },
                { icono: 'flame' as const, texto: 'Haz tu tanda' },
                { icono: 'cash' as const, texto: 'Véndelo' },
              ].map((p, i) => (
                <View key={p.texto} style={e.pasoComo}>
                  <View style={e.iconoComo}>
                    <Icono nombre={p.icono} tamano={20} color={COLOR.bosque} />
                  </View>
                  <Texto style={e.textoComo}>
                    {i + 1}. {p.texto}
                  </Texto>
                </View>
              ))}
            </View>
            <View style={{ alignSelf: 'stretch', gap: 8 }}>
              {alUsarPlantilla && <Boton texto="Usar una receta lista" icono="sparkles" alTocar={alUsarPlantilla} />}
              <Boton tipo={alUsarPlantilla ? 'secundario' : 'primario'} texto="Escribir mi receta" icono="create" alTocar={() => setCreando('nueva')} />
            </View>
            {!insumos.length && !alUsarPlantilla && <Texto v="chico" style={{ textAlign: 'center' }}>Primero compra tus insumos en Abasto o agrégalos en «Insumos».</Texto>}
          </View>
        </Aparecer>
      ) : (
        recetas.map((r, i) => {
          const a = datos.articulos.find((x) => x.id === r.articuloId);
          const c = costoDeReceta(r, datos, referencia);
          const precio = a?.precioVentaCentavos ?? precioSugerido(c.porUnidadCentavos, margenDe(negocio));
          const listas = Math.max(hay.get(r.articuloId)?.cantidad ?? 0, 0);
          const ganas = precio - c.porUnidadCentavos;
          return (
            <Aparecer key={r.id} orden={i}>
              <View style={e.tarjeta}>
                <View style={e.cabeza}>
                  <View style={e.iconoProducto}>
                    <Icono nombre="flame" tamano={24} color={COLOR.bosque} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Texto style={e.nombre} lineas={2}>
                      {r.nombre}
                    </Texto>
                    <Texto v="chico">
                      Tu receta: salen {numeroBonito(r.rinde)} con {r.insumos.length} {r.insumos.length === 1 ? 'insumo' : 'insumos'}
                    </Texto>
                  </View>
                  <View style={[e.listas, listas > 0 && e.listasHay]}>
                    <Texto style={e.numeroListas}>{numeroBonito(listas)}</Texto>
                    <Texto style={e.textoListas}>listas</Texto>
                  </View>
                </View>
                <View style={e.cifras}>
                  <Cifrita nombre="Te cuesta" valor={bs(c.porUnidadCentavos)} />
                  <Cifrita nombre={a?.precioVentaCentavos != null ? 'La vendes' : 'Véndela a'} valor={bs(precio)} />
                  <Cifrita nombre="Ganas" valor={bs(ganas)} fuerte={ganas > 0} />
                </View>
                {c.sinCosto.length > 0 && <Texto v="chico">Falta el precio de: {c.sinCosto.join(', ')}. Anótalo en «Insumos» para que la cuenta sea exacta.</Texto>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1.3 }}>
                    <Boton tipo="oscuro" texto="Hacer una tanda" icono="flame" alTocar={() => setTanda(r.id)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Boton tipo="secundario" texto="Receta" icono="reader" alTocar={() => setVerReceta(r.id)} />
                  </View>
                </View>
              </View>
            </Aparecer>
          );
        })
      )}

      <HojaDeTanda negocio={negocio} datos={datos} referencia={referencia} receta={recetas.find((r) => r.id === tanda) ?? null} alCerrar={() => setTanda(null)} alPedir={alPedir} alVender={alVender} />
      <HojaDeReceta
        negocio={negocio}
        datos={datos}
        referencia={referencia}
        receta={recetas.find((r) => r.id === verReceta) ?? null}
        alCerrar={() => setVerReceta(null)}
        alEditar={(r) => {
          setVerReceta(null);
          setCreando(r);
        }}
      />
      <AsistenteDeReceta negocio={negocio} datos={datos} receta={creando} alCerrar={() => setCreando(null)} />
    </View>
  );
}

function Cifrita({ nombre, valor, fuerte }: { nombre: string; valor: string; fuerte?: boolean }) {
  return (
    <View style={[e.cifrita, fuerte && e.cifritaFuerte]}>
      <Texto style={[e.nombreCifrita, fuerte && { color: COLOR.limaTexto }]}>{nombre}</Texto>
      <Texto style={e.valorCifrita} lineas={1} ajustar>
        {valor}
      </Texto>
    </View>
  );
}

/** Hacer una tanda, paso a paso */
function HojaDeTanda({
  negocio,
  datos,
  receta: r,
  referencia,
  alCerrar,
  alPedir,
  alVender,
}: {
  negocio: NegocioElegido;
  datos: DatosDeNegocio;
  receta: Receta | null;
  referencia?: PrecioDeReferencia;
  alCerrar: () => void;
  alPedir: (f: Faltante[]) => void;
  alVender: () => void;
}) {
  const { aplicar } = useInventario();
  const [paso, setPaso] = useState(0);
  const [cuantas, setCuantas] = useState(0);
  const [salieron, setSalieron] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hecha, setHecha] = useState<{ obtenido: number; costo: number } | null>(null);
  useEffect(() => {
    if (!r) return;
    setPaso(0);
    setCuantas(r.rinde);
    setSalieron(r.rinde);
    setError(null);
    setHecha(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);
  const plan: Plan | null = useMemo(() => {
    if (!r || !(cuantas > 0)) return null;
    try {
      return planificar(r, cuantas, datos, referencia);
    } catch {
      return null;
    }
  }, [r, cuantas, datos, referencia]);
  if (!r) return <HojaInferior visible={false}>{null}</HojaInferior>;
  const lo = nombreDeLoHecho(negocio);
  const faltan = plan?.insumos.filter((i) => i.textoFalta) ?? [];
  const pedibles = faltan.filter((i) => i.articulo.productoId);

  const guardar = async () => {
    try {
      const t = registrarTanda(r, datos, cuantas, salieron, ahora(), nuevoId());
      await aplicar({ tandas: [t.tanda], movimientos: t.movimientos });
      setHecha({ obtenido: salieron, costo: t.tanda.costoTotalCentavos });
      setPaso(2);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo registrar');
    }
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <ContenidoDeHoja gap={16}>
        <View style={{ gap: 2 }}>
          <Texto v="chico">Hacer una tanda</Texto>
          <Texto v="t2">{r.nombre}</Texto>
        </View>
        <Pasos pasos={['¿Cuántas?', '¿Salieron?', 'Listo']} actual={paso} />

        {paso === 0 && (
          <>
            <Texto style={e.pregunta}>¿Cuántas vas a hacer?</Texto>
            <Contador valor={cuantas} alCambiar={setCuantas} paso={Math.max(1, Math.round(r.rinde / 10))} minimo={1} unidad={lo.plural} etiqueta="Cuántas quieres hacer" />
            <Opciones
              opciones={[1, 2, 3].map((k) => ({ clave: String(r.rinde * k), texto: `${numeroBonito(r.rinde * k)}` }))}
              elegida={String(cuantas)}
              alElegir={(v) => setCuantas(Number(v))}
            />
            {plan && (
              <View style={{ gap: 8 }}>
                <Texto v="fuerte">Para eso necesitas</Texto>
                {plan.insumos.map((i) => (
                  <View key={i.articulo.id} style={[e.insumo, i.textoFalta ? e.insumoFalta : e.insumoListo]}>
                    <Icono nombre={i.textoFalta ? 'alert-circle' : 'checkmark-circle'} tamano={22} color={i.textoFalta ? COLOR.ambarTexto : COLOR.bosque} />
                    <View style={{ flex: 1 }}>
                      <Texto v="fuerte" lineas={1}>
                        {i.textoNecesita} de {i.articulo.nombre}
                      </Texto>
                      <Texto v="chico" style={i.textoFalta ? { color: COLOR.ambarTexto } : undefined}>
                        {i.textoFalta ? `Te falta ${i.textoFalta} · tienes ${i.textoTiene}` : `Tienes ${i.textoTiene}`}
                      </Texto>
                    </View>
                  </View>
                ))}
                <Texto v="gris">
                  Esta tanda te cuesta <Texto v="fuerte">{bs(plan.costoCentavos)}</Texto> · {bs(Math.round(plan.costoCentavos / cuantas))} {lo.una}
                </Texto>
              </View>
            )}
            {pedibles.length > 0 && (
              <Boton texto={`Pedir lo que falta a Abasto (${pedibles.length})`} icono="cart" alTocar={() => alPedir(pedibles.map((i) => ({ productoId: i.articulo.productoId!, envases: i.falta })))} />
            )}
            <Boton
              tipo="oscuro"
              texto={plan?.alcanza ? 'Ya las hice' : 'Te faltan insumos'}
              icono="arrow-forward"
              deshabilitado={!plan?.alcanza}
              alTocar={() => {
                setSalieron(cuantas);
                setPaso(1);
              }}
            />
          </>
        )}

        {paso === 1 && (
          <>
            <Texto style={e.pregunta}>¿Cuántas salieron?</Texto>
            <Texto v="gris">Si salieron menos de {numeroBonito(cuantas)}, anota cuántas: la diferencia queda como merma.</Texto>
            <Contador valor={salieron} alCambiar={setSalieron} minimo={1} unidad={lo.plural} etiqueta="Cuántas salieron" />
            {salieron < cuantas && (
              <View style={[e.insumo, e.insumoFalta]}>
                <Icono nombre="information-circle" tamano={20} color={COLOR.ambarTexto} />
                <Texto style={{ flex: 1, color: COLOR.ambarTexto }}>Merma: {numeroBonito(cuantas - salieron)} {lo.plural}</Texto>
              </View>
            )}
            {error && <Falla texto={error} />}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Boton tipo="secundario" texto="Atrás" alTocar={() => setPaso(0)} />
              </View>
              <View style={{ flex: 1.4 }}>
                <Boton tipo="oscuro" texto="Guardar tanda" icono="checkmark" alTocar={() => void guardar()} />
              </View>
            </View>
          </>
        )}

        {paso === 2 && hecha && (
          <>
            <View style={e.listo}>
              <View style={e.checkGrande}>
                <Icono nombre="checkmark" tamano={36} color={COLOR.bosque} />
              </View>
              <Texto style={e.pregunta}>¡Listo!</Texto>
              <Texto v="gris" style={{ textAlign: 'center' }}>
                Sumamos {numeroBonito(hecha.obtenido)} {r.nombre} a {lo.titulo.toLowerCase()} y descontamos los insumos.
              </Texto>
              <Texto v="fuerte" style={{ textAlign: 'center' }}>
                Te costó {bs(hecha.costo)} · {bs(Math.round(hecha.costo / hecha.obtenido))} {lo.una}
              </Texto>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Boton tipo="secundario" texto="Cerrar" alTocar={alCerrar} />
              </View>
              <View style={{ flex: 1.3 }}>
                <Boton
                  texto="Vender ahora"
                  icono="cash"
                  alTocar={() => {
                    alCerrar();
                    alVender();
                  }}
                />
              </View>
            </View>
          </>
        )}
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

/** Ver la receta: qué lleva, cuánto cuesta y a cuánto la vendes (editable) */
function HojaDeReceta({
  negocio,
  datos,
  receta: r,
  referencia,
  alCerrar,
  alEditar,
}: {
  negocio: NegocioElegido;
  datos: DatosDeNegocio;
  receta: Receta | null;
  referencia?: PrecioDeReferencia;
  alCerrar: () => void;
  alEditar: (r: Receta) => void;
}) {
  const { aplicar } = useInventario();
  const a = r ? datos.articulos.find((x) => x.id === r.articuloId) : undefined;
  const [precio, setPrecio] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPrecio(a?.precioVentaCentavos != null ? bsEnCampo(a.precioVentaCentavos) : '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);
  if (!r || !a) return <HojaInferior visible={false}>{null}</HojaInferior>;
  const c = costoDeReceta(r, datos, referencia);
  const sugerido = precioSugerido(c.porUnidadCentavos, margenDe(negocio));
  const lo = nombreDeLoHecho(negocio);

  const guardarPrecio = async () => {
    const p = precio.trim() ? leerBs(precio) : null;
    if (p !== null && Number.isNaN(p)) return setError('Revisa el precio, por ejemplo 6 o 5,50');
    await aplicar({ articulos: [conPrecio(a, p, ahora())] });
    alCerrar();
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <ContenidoDeHoja gap={14}>
        <View style={{ gap: 2 }}>
          <Texto v="chico">Receta</Texto>
          <Texto v="t2">{r.nombre}</Texto>
          <Texto v="gris">Con esto salen {numeroBonito(r.rinde)} {lo.plural}</Texto>
        </View>
        <View style={ui.tarjeta}>
          {r.insumos.map((i) => {
            const insumo = datos.articulos.find((x) => x.id === i.articuloId);
            return (
              <View key={i.articuloId} style={e.renglon}>
                <View style={e.punto} />
                <Texto style={{ flex: 1 }} lineas={1}>
                  {insumo?.nombre ?? 'Un insumo que ya no está'}
                </Texto>
                <Texto v="fuerte">{insumo ? textoDeReceta(insumo, i.cantidad) : ''}</Texto>
              </View>
            );
          })}
        </View>
        <View style={e.cifras}>
          <Cifrita nombre="La tanda" valor={bs(c.totalCentavos)} />
          <Cifrita nombre={lo.una.replace('cada', 'Cada')} valor={bs(c.porUnidadCentavos)} />
        </View>
        <Campo etiqueta={`¿A cuánto vendes ${lo.una}? (Bs)`} valor={precio} alCambiar={setPrecio} teclado="decimal-pad" ejemplo={bsEnCampo(sugerido)} />
        <Texto v="chico">Sugerido: {bs(sugerido)} (tu costo + {Math.round(margenDe(negocio) * 100)} %). Si lo dejas vacío, se usa el sugerido.</Texto>
        {error && <Falla texto={error} />}
        <Boton tipo="oscuro" texto="Guardar precio" icono="pricetag" alTocar={() => void guardarPrecio()} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Boton tipo="secundario" texto="Editar receta" icono="create" alTocar={() => alEditar(r)} />
          </View>
          <View style={{ flex: 1 }}>
            <Boton
              tipo="chico"
              texto="Borrar receta"
              alTocar={() => {
                void aplicar({ recetas: [{ ...r, eliminado: true, actualizadoEn: ahora() }] });
                alCerrar();
              }}
            />
          </View>
        </View>
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

/** Nueva receta (o editar una), en tres pasos */
function AsistenteDeReceta({ negocio, datos, receta, alCerrar }: { negocio: NegocioElegido; datos: DatosDeNegocio; receta: Receta | 'nueva' | null; alCerrar: () => void }) {
  const { aplicar } = useInventario();
  const editando = receta && receta !== 'nueva' ? receta : null;
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState('');
  const [rinde, setRinde] = useState(100);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!receta) return;
    setPaso(0);
    setError(null);
    setNombre(editando?.nombre ?? '');
    setRinde(editando?.rinde ?? 100);
    setCantidades(Object.fromEntries((editando?.insumos ?? []).map((i) => [i.articuloId, String(i.cantidad).replace('.', ',')])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receta]);
  const lo = nombreDeLoHecho(negocio);
  const insumos = existencias(datos).filter((x) => x.articulo.clase === 'COMPRADO');
  const elegidos = Object.entries(cantidades)
    .map(([articuloId, v]) => ({ articuloId, cantidad: leerCantidad(v) }))
    .filter((i) => !Number.isNaN(i.cantidad) && i.cantidad > 0);
  // El costo en vivo, con la receta como va quedando
  const costo = elegidos.length && rinde > 0 ? costoDeReceta({ id: 'x', articuloId: 'x', nombre, rinde, insumos: elegidos, actualizadoEn: '', eliminado: false }, datos) : null;

  const guardar = async () => {
    try {
      const t = ahora();
      const existente = editando ? datos.articulos.find((a) => a.id === editando.articuloId) : datos.articulos.find((a) => a.clase === 'HECHO' && !a.eliminado && a.nombre.toLowerCase() === nombre.trim().toLowerCase());
      const hecho = existente ? { ...existente, nombre: nombre.trim(), actualizadoEn: t } : articuloHecho(nombre, t, `hecho:${nuevoId()}`);
      const r = armarReceta({ id: editando?.id ?? nuevoId(), articuloId: hecho.id, nombre: hecho.nombre, rinde, insumos: elegidos }, t);
      await aplicar({ articulos: [hecho], recetas: [r] });
      alCerrar();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Revisa la receta');
    }
  };

  const siguiente = () => {
    setError(null);
    if (paso === 0 && nombre.trim().length < 2) return setError('Escribe qué haces, por ejemplo «Salteña de pollo»');
    if (paso === 1 && !(rinde > 0)) return setError('¿Cuántas salen?');
    setPaso(paso + 1);
  };

  return (
    <HojaInferior visible={!!receta} alCerrar={alCerrar}>
      <ContenidoDeHoja gap={16}>
        <View style={{ gap: 2 }}>
          <Texto v="chico">{editando ? 'Editar receta' : 'Nueva receta'}</Texto>
          <Texto v="t2">{nombre.trim() || 'Tu receta'}</Texto>
        </View>
        <Pasos pasos={['¿Qué haces?', '¿Cuántas?', '¿Qué lleva?']} actual={paso} />

        {paso === 0 && (
          <>
            <Texto style={e.pregunta}>¿Qué haces?</Texto>
            <Campo etiqueta="Nombre" valor={nombre} alCambiar={setNombre} ejemplo={(SUGERENCIAS[negocio.subtipo ?? 'salteneria'] ?? [])[0]} mayusculas />
            <Opciones opciones={(SUGERENCIAS[negocio.subtipo ?? 'salteneria'] ?? []).map((s) => ({ clave: s, texto: s }))} elegida={nombre} alElegir={setNombre} />
          </>
        )}

        {paso === 1 && (
          <>
            <Texto style={e.pregunta}>¿Cuántas salen con una tanda?</Texto>
            <Texto v="gris">Piensa en lo que haces de una vez, por ejemplo 100 {lo.plural} con un quintal de harina.</Texto>
            <Contador valor={rinde} alCambiar={setRinde} paso={10} minimo={1} unidad={lo.plural} etiqueta="Cuántas salen con esto" />
            <Opciones opciones={[50, 100, 200].map((n) => ({ clave: String(n), texto: String(n) }))} elegida={String(rinde)} alElegir={(v) => setRinde(Number(v))} />
          </>
        )}

        {paso === 2 && (
          <>
            <Texto style={e.pregunta}>¿Qué lleva para {numeroBonito(rinde)}?</Texto>
            <Texto v="gris">Toca cada insumo que usas y escribe cuánto.</Texto>
            {insumos.length ? (
              insumos.map((x) => {
                const v = cantidades[x.articulo.id];
                const elegido = v !== undefined;
                return (
                  <Tocable
                    key={x.articulo.id}
                    hundir={0.99}
                    onPress={() =>
                      setCantidades((c) => {
                        const n = { ...c };
                        if (elegido) delete n[x.articulo.id];
                        else n[x.articulo.id] = '';
                        return n;
                      })
                    }
                    style={[e.opcionInsumo, elegido && e.opcionInsumoElegida]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: elegido }}
                    accessibilityLabel={x.articulo.nombre}
                  >
                    <View style={[e.marca, elegido && e.marcaElegida]}>{elegido && <Icono nombre="checkmark" tamano={14} color={COLOR.lima} />}</View>
                    <View style={{ flex: 1 }}>
                      <Texto v="fuerte" lineas={1}>
                        {x.articulo.nombre}
                      </Texto>
                      <Texto v="chico">Tienes {x.texto}</Texto>
                    </View>
                    {elegido && (
                      <View style={e.campoInsumo}>
                        <TextInput
                          accessibilityLabel={`Cuánto lleva de ${x.articulo.nombre}`}
                          value={v}
                          onChangeText={(t) => setCantidades((c) => ({ ...c, [x.articulo.id]: t }))}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={COLOR.texto3}
                          autoFocus={!v}
                          style={e.entradaInsumo}
                        />
                        <Texto v="gris">{unidadDeReceta(x.articulo)}</Texto>
                      </View>
                    )}
                  </Tocable>
                );
              })
            ) : (
              <Texto v="gris">Todavía no tienes insumos. Cómpralos en Abasto o agrégalos en «Insumos».</Texto>
            )}
            {costo && (
              <View style={e.costoVivo}>
                <Texto style={e.textoCostoVivo}>Con esto, {lo.una} te cuesta</Texto>
                <Texto style={e.costoGrande}>{bs(costo.porUnidadCentavos)}</Texto>
                <Texto style={e.textoCostoVivo}>La tanda completa: {bs(costo.totalCentavos)}</Texto>
              </View>
            )}
          </>
        )}

        {error && <Falla texto={error} />}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {paso > 0 && (
            <View style={{ flex: 1 }}>
              <Boton tipo="secundario" texto="Atrás" alTocar={() => setPaso(paso - 1)} />
            </View>
          )}
          <View style={{ flex: 1.4 }}>
            {paso < 2 ? <Boton tipo="oscuro" texto="Siguiente" icono="arrow-forward" alTocar={siguiente} /> : <Boton tipo="oscuro" texto="Guardar receta" icono="checkmark" deshabilitado={!elegidos.length} alTocar={() => void guardar()} />}
          </View>
        </View>
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

const e = StyleSheet.create({
  bienvenida: { alignItems: 'center', gap: 10, padding: 20, borderRadius: 26, backgroundColor: COLOR.superficie, ...SOMBRA },
  imagenBienvenida: { width: 170, height: 170 },
  tituloBienvenida: { fontFamily: FUENTE.negra, fontSize: 22, color: COLOR.texto, letterSpacing: -0.5 },
  comoFunciona: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginVertical: 6 },
  pasoComo: { flex: 1, alignItems: 'center', gap: 6, padding: 10, borderRadius: 16, backgroundColor: COLOR.limaSuave },
  iconoComo: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  textoComo: { fontFamily: FUENTE.fuerte, fontSize: 12.5, color: COLOR.bosque, textAlign: 'center' },
  tarjeta: { gap: 12, padding: 14, borderRadius: 24, backgroundColor: COLOR.superficie, ...SOMBRA },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconoProducto: { width: 50, height: 50, borderRadius: 16, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  nombre: { fontFamily: FUENTE.negra, fontSize: 18, color: COLOR.texto, letterSpacing: -0.4 },
  listas: { alignItems: 'center', minWidth: 64, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 16, backgroundColor: COLOR.tenue },
  listasHay: { backgroundColor: COLOR.bosque },
  numeroListas: { fontFamily: FUENTE.negra, fontSize: 20, color: COLOR.lima, letterSpacing: -0.5 },
  textoListas: { fontFamily: FUENTE.fuerte, fontSize: 11, color: COLOR.limaMedia },
  cifras: { flexDirection: 'row', gap: 8 },
  cifrita: { flex: 1, gap: 2, padding: 10, borderRadius: 14, backgroundColor: COLOR.tenue },
  cifritaFuerte: { backgroundColor: COLOR.limaMedia },
  nombreCifrita: { fontFamily: FUENTE.semi, fontSize: 11.5, color: COLOR.texto2 },
  valorCifrita: { fontFamily: FUENTE.negra, fontSize: 16, color: COLOR.bosque },
  pregunta: { fontFamily: FUENTE.negra, fontSize: 22, color: COLOR.texto, letterSpacing: -0.5 },
  insumo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16 },
  insumoListo: { backgroundColor: COLOR.limaSuave },
  insumoFalta: { backgroundColor: COLOR.ambarSuave },
  listo: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  checkGrande: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR.lima },
  opcionInsumo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: COLOR.superficie, borderWidth: 2, borderColor: COLOR.borde },
  opcionInsumoElegida: { borderColor: COLOR.bosque, backgroundColor: COLOR.limaSuave },
  marca: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: COLOR.borde, alignItems: 'center', justifyContent: 'center' },
  marcaElegida: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  campoInsumo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entradaInsumo: { width: 70, height: 44, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: COLOR.bosque, backgroundColor: COLOR.superficie, textAlign: 'right', fontFamily: FUENTE.negra, fontSize: 17, color: COLOR.texto },
  costoVivo: { alignItems: 'center', gap: 2, padding: 14, borderRadius: 18, backgroundColor: COLOR.bosque },
  textoCostoVivo: { fontFamily: FUENTE.semi, fontSize: 13, color: COLOR.limaMedia },
  costoGrande: { fontFamily: FUENTE.negra, fontSize: 28, color: COLOR.lima, letterSpacing: -0.6 },
});
