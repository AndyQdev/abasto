import {
  articuloHecho,
  bs,
  costoDeReceta,
  existencias,
  leerCantidad,
  margenDe,
  numeroBonito,
  planificar,
  precioSugerido,
  receta as armarReceta,
  registrarTanda,
  textoDeReceta,
  unidadDeReceta,
  type DatosDeNegocio,
  type Faltante,
  type NegocioElegido,
  type Plan,
  type Receta,
} from '@abasto/comercio';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Aparecer, HojaInferior, Tocable } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { ahora, nuevoId, useInventario } from '../inventario';
import { COLOR, FUENTE } from '../tema';
import { BotonDeAccion, Campo, CabezaDeSeccion, ContenidoDeHoja, Listo, enCampo, fecha, ui } from './ui';

/**
 * «Recetas» del productor (fase 5): cada receta dice cuánto sale («100 salteñas») y cuánto lleva de cada insumo. Con
 * el costo de los insumos sale el costo por unidad. Desde la receta se planifica («quiero hacer 300»), se pide a Abasto
 * lo que falta y se registra la tanda: descuenta los insumos y suma lo hecho a «Lo que haces».
 */
export function Recetas({ negocio, datos, alPedir }: { negocio: NegocioElegido; datos: DatosDeNegocio; alPedir: (faltantes: Faltante[]) => void }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const recetas = datos.recetas.filter((r) => !r.eliminado);
  const nombreDe = (id: string) => datos.articulos.find((a) => a.id === id)?.nombre ?? '';
  const tandas = [...datos.tandas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);

  return (
    <View style={{ gap: 16 }}>
      <BotonDeAccion icono="add" titulo="Nueva receta" detalle="Lo que haces y cuánto lleva de cada insumo" alTocar={() => setNueva(true)} />
      <CabezaDeSeccion icono="restaurant" titulo="Tus recetas" subtitulo="Con lo que te cuesta cada unidad" />
      {recetas.length ? (
        recetas.map((r, i) => {
          const c = costoDeReceta(r, datos);
          return (
            <Aparecer key={r.id} orden={i}>
              <Tocable onPress={() => setAbierta(r.id)} style={ui.fila} accessibilityRole="button" accessibilityLabel={`${r.nombre}: cada una te cuesta ${bs(c.porUnidadCentavos)}`}>
                <View style={e.icono}>
                  <Icono nombre="flame" tamano={22} color={COLOR.bosque} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto v="fuerte">{r.nombre}</Texto>
                  <Texto v="chico">
                    Salen {numeroBonito(r.rinde)} · {r.insumos.length} {r.insumos.length === 1 ? 'insumo' : 'insumos'}
                  </Texto>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Texto style={e.costo}>{bs(c.porUnidadCentavos)}</Texto>
                  <Texto v="chico">cada una</Texto>
                </View>
              </Tocable>
            </Aparecer>
          );
        })
      ) : (
        <View style={ui.vacio}>
          <Icono nombre="restaurant-outline" tamano={20} color={COLOR.texto3} />
          <Texto v="gris" style={{ flex: 1 }}>
            Anota tu primera receta y te decimos cuánto te cuesta cada salteña, cada pan o cada plato.
          </Texto>
        </View>
      )}

      {tandas.length > 0 && (
        <View style={ui.tarjeta}>
          <CabezaDeSeccion icono="time" titulo="Últimas tandas" />
          {tandas.map((t) => (
            <View key={t.id} style={e.renglon}>
              <Texto style={{ flex: 1 }} lineas={1}>
                {nombreDe(t.articuloId)}
              </Texto>
              <Texto v="chico">{fecha(t.fecha)}</Texto>
              <Texto style={e.tanda}>
                {numeroBonito(t.obtenido)}
                {t.obtenido < t.planificado ? ` de ${numeroBonito(t.planificado)}` : ''}
              </Texto>
            </View>
          ))}
        </View>
      )}

      <HojaDeReceta negocio={negocio} datos={datos} receta={recetas.find((r) => r.id === abierta) ?? null} alCerrar={() => setAbierta(null)} alPedir={alPedir} />
      <HojaDeRecetaNueva visible={nueva} datos={datos} alCerrar={() => setNueva(false)} />
    </View>
  );
}

function HojaDeReceta({ negocio, datos, receta: r, alCerrar, alPedir }: { negocio: NegocioElegido; datos: DatosDeNegocio; receta: Receta | null; alCerrar: () => void; alPedir: (f: Faltante[]) => void }) {
  const { aplicar } = useInventario();
  const [cuantas, setCuantas] = useState('');
  const [salieron, setSalieron] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  useEffect(() => {
    setCuantas(r ? enCampo(r.rinde) : '');
    setSalieron('');
    setError(null);
    setListo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.id]);
  const n = leerCantidad(cuantas);
  const plan: Plan | null = useMemo(() => {
    if (!r || Number.isNaN(n) || n <= 0) return null;
    try {
      return planificar(r, n, datos);
    } catch {
      return null;
    }
  }, [r, n, datos]);
  if (!r) return <HojaInferior visible={false}>{null}</HojaInferior>;

  const c = costoDeReceta(r, datos);
  const sugerido = precioSugerido(c.porUnidadCentavos, margenDe(negocio));
  const faltan = plan?.insumos.filter((i) => i.textoFalta) ?? [];
  const pedibles = faltan.filter((i) => i.articulo.productoId);

  const registrar = async () => {
    const obtenido = salieron.trim() ? leerCantidad(salieron) : n;
    if (Number.isNaN(n) || n <= 0) return setError('¿Cuántas querías hacer?');
    if (Number.isNaN(obtenido) || obtenido <= 0) return setError('¿Cuántas salieron?');
    try {
      const t = registrarTanda(r, datos, n, obtenido, ahora(), nuevoId());
      await aplicar({ tandas: [t.tanda], movimientos: t.movimientos });
      setError(null);
      setSalieron('');
      setListo(`Registramos ${numeroBonito(obtenido)} ${r.nombre}: ya están en «Lo que haces»`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo registrar');
    }
  };
  const borrar = async () => {
    await aplicar({ recetas: [{ ...r, eliminado: true, actualizadoEn: ahora() }] });
    alCerrar();
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <ContenidoDeHoja gap={14}>
        <View style={{ gap: 2 }}>
          <Texto v="t2">{r.nombre}</Texto>
          <Texto v="gris">Salen {numeroBonito(r.rinde)} con estas cantidades</Texto>
        </View>
        <View style={e.cuadro}>
          <Texto v="chico">Cada una te cuesta</Texto>
          <Texto style={e.grande}>{bs(c.porUnidadCentavos)}</Texto>
          <Texto v="gris">
            La tanda completa: {bs(c.totalCentavos)}. Precio sugerido: {bs(sugerido)} (costo + {Math.round(margenDe(negocio) * 100)} %).
          </Texto>
          {c.sinCosto.length > 0 && <Texto v="chico">Sin precio: {c.sinCosto.join(', ')}. Anota cuánto te costó para que el cálculo sea exacto.</Texto>}
        </View>

        <Texto v="fuerte">¿Cuántas quieres hacer?</Texto>
        <TextInput accessibilityLabel="Cuántas quieres hacer" value={cuantas} onChangeText={setCuantas} keyboardType="decimal-pad" style={e.entradaGrande} />
        {plan && (
          <View style={{ gap: 6 }}>
            {plan.insumos.map((i) => (
              <View key={i.articulo.id} style={e.insumo}>
                <Icono nombre={i.textoFalta ? 'alert-circle' : 'checkmark-circle'} tamano={20} color={i.textoFalta ? COLOR.ambarTexto : COLOR.bosque} />
                <View style={{ flex: 1 }}>
                  <Texto v="fuerte" lineas={1}>
                    {i.articulo.nombre}: {i.textoNecesita}
                  </Texto>
                  <Texto v="chico">{i.textoFalta ? `Tienes ${i.textoTiene}; te falta ${i.textoFalta}` : `Tienes ${i.textoTiene}`}</Texto>
                </View>
              </View>
            ))}
            <Texto v="chico">Esta tanda te cuesta {bs(plan.costoCentavos)}.</Texto>
          </View>
        )}
        {pedibles.length > 0 && (
          <Boton
            texto={`Pedir lo que falta a Abasto (${pedibles.length})`}
            icono="cart"
            alTocar={() => alPedir(pedibles.map((i) => ({ productoId: i.articulo.productoId!, envases: i.falta })))}
          />
        )}

        <Texto v="fuerte">¿Ya la hiciste?</Texto>
        <Campo etiqueta={`¿Cuántas salieron? (si salieron ${cuantas || 'las mismas'}, déjalo vacío)`} valor={salieron} alCambiar={setSalieron} teclado="decimal-pad" ejemplo={cuantas} />
        {error && <Falla texto={error} />}
        {listo && <Listo texto={listo} />}
        <Boton tipo="oscuro" texto="Registrar tanda" icono="checkmark-done" deshabilitado={!plan?.alcanza} alTocar={() => void registrar()} />
        {plan && !plan.alcanza && <Texto v="chico">Para registrar la tanda tienen que alcanzar los insumos: pide lo que falta o corrige lo que tienes en Inventario.</Texto>}
        <Boton tipo="chico" texto="Borrar receta" alTocar={() => void borrar()} />
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

/** Una receta nueva: qué haces, cuántas salen y cuánto lleva de cada insumo de tu inventario */
function HojaDeRecetaNueva({ visible, datos, alCerrar }: { visible: boolean; datos: DatosDeNegocio; alCerrar: () => void }) {
  const { aplicar } = useInventario();
  const [nombre, setNombre] = useState('');
  const [rinde, setRinde] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const insumos = existencias(datos).filter((x) => x.articulo.clase === 'COMPRADO');

  const guardar = async () => {
    try {
      const t = ahora();
      const hecho = datos.articulos.find((a) => a.clase === 'HECHO' && !a.eliminado && a.nombre.toLowerCase() === nombre.trim().toLowerCase()) ?? articuloHecho(nombre, t, `hecho:${nuevoId()}`);
      const r = armarReceta(
        {
          id: nuevoId(),
          articuloId: hecho.id,
          nombre: hecho.nombre,
          rinde: leerCantidad(rinde),
          insumos: Object.entries(cantidades)
            .map(([articuloId, v]) => ({ articuloId, cantidad: leerCantidad(v) }))
            .filter((i) => !Number.isNaN(i.cantidad) && i.cantidad > 0),
        },
        t,
      );
      await aplicar({ articulos: datos.articulos.some((a) => a.id === hecho.id) ? [] : [hecho], recetas: [r] });
      setNombre('');
      setRinde('');
      setCantidades({});
      setError(null);
      alCerrar();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Revisa la receta');
    }
  };

  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <ContenidoDeHoja>
        <View style={{ gap: 2 }}>
          <Texto v="t2">Nueva receta</Texto>
          <Texto v="gris">Escribe cuánto lleva una tanda. Los insumos salen de tu inventario.</Texto>
        </View>
        <Campo etiqueta="¿Qué haces?" valor={nombre} alCambiar={setNombre} ejemplo="Salteña de pollo" mayusculas />
        <Campo etiqueta="¿Cuántas salen con esto?" valor={rinde} alCambiar={setRinde} teclado="decimal-pad" ejemplo="100" />
        <Texto v="fuerte">¿Cuánto lleva?</Texto>
        {insumos.length ? (
          insumos.map((x) => (
            <View key={x.articulo.id} style={e.filaInsumo}>
              <Texto style={{ flex: 1 }} lineas={2}>
                {x.articulo.nombre}
              </Texto>
              <TextInput
                accessibilityLabel={`Cuánto lleva de ${x.articulo.nombre}`}
                value={cantidades[x.articulo.id] ?? ''}
                onChangeText={(v) => setCantidades((c) => ({ ...c, [x.articulo.id]: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={COLOR.texto3}
                style={e.entradaInsumo}
              />
              <Texto v="gris" style={{ width: 64 }}>
                {unidadDeReceta(x.articulo)}
              </Texto>
            </View>
          ))
        ) : (
          <Texto v="gris">Primero compra tus insumos en Abasto o agrégalos a mano en Inventario.</Texto>
        )}
        {error && <Falla texto={error} />}
        <Boton tipo="oscuro" texto="Guardar receta" icono="checkmark" alTocar={() => void guardar()} />
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

/** Para mostrar los insumos de una receta en otras pantallas */
export const insumosDe = (r: Receta, datos: DatosDeNegocio) =>
  r.insumos.map((i) => {
    const a = datos.articulos.find((x) => x.id === i.articuloId);
    return a ? `${a.nombre}: ${textoDeReceta(a, i.cantidad)}` : '';
  });

const e = StyleSheet.create({
  icono: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLOR.limaSuave, alignItems: 'center', justifyContent: 'center' },
  costo: { fontFamily: FUENTE.negra, fontSize: 17, color: COLOR.bosque },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  tanda: { minWidth: 70, textAlign: 'right', fontFamily: FUENTE.fuerte, color: COLOR.bosque },
  cuadro: { gap: 4, padding: 14, borderRadius: 18, backgroundColor: COLOR.limaSuave },
  grande: { fontFamily: FUENTE.negra, fontSize: 28, color: COLOR.bosque, letterSpacing: -0.6 },
  entradaGrande: { height: 54, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie, fontFamily: FUENTE.negra, fontSize: 22, color: COLOR.texto },
  insumo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: COLOR.tenue },
  filaInsumo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entradaInsumo: { width: 80, height: 44, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: COLOR.borde, backgroundColor: COLOR.superficie, textAlign: 'right', fontFamily: FUENTE.fuerte, fontSize: 16, color: COLOR.texto },
});
