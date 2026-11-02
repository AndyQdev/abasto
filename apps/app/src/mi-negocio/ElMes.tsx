import { anotacion, bs, mesDe, nombreDelMes, otroMes, reporteDelMes, type DatosDeNegocio } from '@abasto/comercio';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HojaInferior, Tocable } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { ahora, nuevoId, useInventario } from '../inventario';
import { COLOR, FUENTE } from '../tema';
import { BotonDeAccion, Campo, CabezaDeSeccion, Cifra, ContenidoDeHoja, Opciones, fecha, leerBs, ui } from './ui';

const GASTOS_DEL_NEGOCIO = ['Alquiler', 'Luz y agua', 'Gas', 'Transporte', 'Sueldos', 'Otros'];

/**
 * «El mes» (tienda y productor), en palabras simples: vendí, me costó, gané, gastos y me quedó. Los gastos del negocio
 * (alquiler, luz, gas) se anotan aquí; lo comprado en Abasto no es gasto: se cuenta como costo cuando se vende.
 */
export function ElMes({ datos, nombreDe }: { datos: DatosDeNegocio; nombreDe: (articuloId: string) => string }) {
  const { aplicar } = useInventario();
  const [mes, setMes] = useState(mesDe(ahora()));
  const [anotando, setAnotando] = useState(false);
  const r = reporteDelMes(datos, mes);
  const gastos = datos.anotaciones.filter((a) => a.tipo === 'GASTO' && a.origen === 'MANUAL' && mesDe(a.fecha) === mes).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const esEsteMes = mes === mesDe(ahora());

  return (
    <View style={{ gap: 16 }}>
      <View style={e.mes}>
        <Tocable onPress={() => setMes(otroMes(mes, -1))} style={e.flecha} accessibilityRole="button" accessibilityLabel="Mes anterior">
          <Icono nombre="chevron-back" tamano={20} color={COLOR.bosque} />
        </Tocable>
        <Texto style={e.nombreMes}>{nombreDelMes(mes)}</Texto>
        <Tocable onPress={() => !esEsteMes && setMes(otroMes(mes, 1))} style={[e.flecha, esEsteMes && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Mes siguiente">
          <Icono nombre="chevron-forward" tamano={20} color={COLOR.bosque} />
        </Tocable>
      </View>

      <Cifra nombre={r.gananciaNetaCentavos >= 0 ? 'Te quedó (ganancia neta)' : 'Perdiste este mes'} valor={bs(Math.abs(r.gananciaNetaCentavos))} tono="fuerte" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Cifra nombre="Vendiste" valor={bs(r.ventasCentavos)} />
        <Cifra nombre="Te costó" valor={bs(r.costoCentavos)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Cifra nombre="Ganaste (bruta)" valor={bs(r.gananciaBrutaCentavos)} tono={r.gananciaBrutaCentavos < 0 ? 'malo' : 'normal'} />
        <Cifra nombre="Gastos" valor={bs(r.gastosCentavos)} />
      </View>
      <Texto v="chico">
        {r.ventas} {r.ventas === 1 ? 'venta' : 'ventas'}
        {r.fiadoCentavos > 0 ? ` · ${bs(r.fiadoCentavos)} fiado` : ''}. Ganancia neta = vendiste − te costó − gastos.
      </Texto>

      {r.masVendidos.length > 0 && (
        <View style={ui.tarjeta}>
          <CabezaDeSeccion icono="trophy" titulo="Lo que más te deja" />
          {r.masVendidos.map((m) => (
            <View key={m.articuloId} style={e.renglon}>
              <Texto style={{ flex: 1 }} lineas={1}>
                {nombreDe(m.articuloId)}
              </Texto>
              <Texto v="chico">{m.cantidad} vendidos</Texto>
              <Texto style={e.ganancia}>+ {bs(m.gananciaCentavos)}</Texto>
            </View>
          ))}
        </View>
      )}

      <BotonDeAccion icono="receipt" titulo="Anotar un gasto" detalle="Alquiler, luz, gas, transporte…" alTocar={() => setAnotando(true)} />
      {gastos.length > 0 && (
        <View style={ui.tarjeta}>
          <CabezaDeSeccion icono="wallet" titulo="Gastos del mes" />
          {gastos.map((g) => (
            <View key={g.id} style={e.renglon}>
              <Texto style={{ flex: 1 }}>{g.nota ? `${g.categoria} · ${g.nota}` : g.categoria}</Texto>
              <Texto v="chico">{fecha(g.fecha)}</Texto>
              <Texto style={e.gasto}>{bs(g.montoCentavos)}</Texto>
            </View>
          ))}
        </View>
      )}
      <HojaDeAnotacion
        visible={anotando}
        tipo="GASTO"
        categorias={GASTOS_DEL_NEGOCIO}
        alCerrar={() => setAnotando(false)}
        alGuardar={async (monto, categoria, nota) => {
          await aplicar({ anotaciones: [anotacion('GASTO', monto, categoria, nota, ahora(), nuevoId())] });
          setAnotando(false);
        }}
      />
    </View>
  );
}

/** Anotar un ingreso o un gasto: monto, para qué y una nota opcional. La usan El mes y las Cuentas de la casa */
export function HojaDeAnotacion({
  visible,
  tipo,
  categorias,
  alCerrar,
  alGuardar,
}: {
  visible: boolean;
  tipo: 'INGRESO' | 'GASTO';
  categorias: readonly string[];
  alCerrar: () => void;
  alGuardar: (montoCentavos: number, categoria: string, nota: string | null) => Promise<void>;
}) {
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    const centavos = leerBs(monto);
    if (Number.isNaN(centavos) || centavos <= 0) return setError('Escribe el monto, por ejemplo 150 o 12,50');
    if (!categoria) return setError(tipo === 'GASTO' ? 'Elige en qué gastaste' : 'Elige de dónde vino');
    try {
      await alGuardar(centavos, categoria, nota.trim() || null);
      setMonto('');
      setCategoria(null);
      setNota('');
      setError(null);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo anotar');
    }
  };
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <ContenidoDeHoja>
        <Texto v="t2">{tipo === 'GASTO' ? 'Anotar un gasto' : 'Anotar un ingreso'}</Texto>
        <Campo etiqueta="Monto (Bs)" valor={monto} alCambiar={setMonto} teclado="decimal-pad" ejemplo="0,00" />
        <Texto v="fuerte">{tipo === 'GASTO' ? '¿En qué?' : '¿De dónde?'}</Texto>
        <Opciones opciones={categorias.map((c) => ({ clave: c, texto: c }))} elegida={categoria} alElegir={setCategoria} />
        <Campo etiqueta="Nota (opcional)" valor={nota} alCambiar={setNota} ejemplo={tipo === 'GASTO' ? 'Luz de noviembre' : 'Quincena'} mayusculas />
        {error && <Falla texto={error} />}
        <Boton tipo="oscuro" texto="Anotar" icono="checkmark" alTocar={() => void guardar()} />
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

const e = StyleSheet.create({
  mes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flecha: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLOR.limaMedia, alignItems: 'center', justifyContent: 'center' },
  nombreMes: { fontFamily: FUENTE.negra, fontSize: 19, color: COLOR.texto, textTransform: 'capitalize' },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  ganancia: { minWidth: 84, textAlign: 'right', fontFamily: FUENTE.fuerte, color: COLOR.limaTexto },
  gasto: { minWidth: 84, textAlign: 'right', fontFamily: FUENTE.fuerte, color: COLOR.ambarTexto },
});
