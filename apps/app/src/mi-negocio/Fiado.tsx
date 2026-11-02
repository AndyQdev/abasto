import { anotarFiado, bs, clienteDeFiado, saldosDeFiado, totalFiado, type DatosDeNegocio, type SaldoDeFiado } from '@abasto/comercio';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Aparecer, HojaInferior, Tocable } from '../animacion';
import { Boton, Falla, Icono, Texto } from '../componentes';
import { ahora, nuevoId, useInventario } from '../inventario';
import { COLOR, FUENTE } from '../tema';
import { Campo, CabezaDeSeccion, Cifra, ContenidoDeHoja, Listo, bsEnCampo, fecha, leerBs, ui } from './ui';

/**
 * El cuaderno de fiado (fase 4): quién debe, cuánto y desde cuándo. Las ventas fiadas entran solas desde la caja; aquí
 * se anota lo que pagan (o una deuda sin venta) y se le puede escribir por WhatsApp.
 */
export function Fiado({ datos, nuevo: senal = 0 }: { datos: DatosDeNegocio; /** Sube con el botón flotante */ nuevo?: number }) {
  const { aplicar } = useInventario();
  const saldos = saldosDeFiado(datos);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const deben = saldos.filter((s) => s.saldoCentavos > 0);
  const elegido = saldos.find((s) => s.cliente.id === abierto) ?? null;
  useEffect(() => {
    if (senal > 0) setNuevo(true);
  }, [senal]);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Cifra nombre="Te deben" valor={bs(totalFiado(saldos))} tono="fuerte" />
        <Cifra nombre="Personas" valor={`${deben.length} de ${saldos.length}`} />
      </View>
      <CabezaDeSeccion icono="book" titulo="Tu cuaderno" subtitulo="El que más debe primero" />
      {saldos.length ? (
        saldos.map((s, i) => (
          <Aparecer key={s.cliente.id} orden={i}>
            <Tocable onPress={() => setAbierto(s.cliente.id)} style={ui.fila} accessibilityRole="button" accessibilityLabel={`${s.cliente.nombre}: ${s.saldoCentavos > 0 ? `debe ${bs(s.saldoCentavos)}` : 'al día'}`}>
              <View style={[e.inicial, s.saldoCentavos > 0 && { backgroundColor: COLOR.ambarSuave }]}>
                <Texto style={e.textoInicial}>{s.cliente.nombre.slice(0, 1).toUpperCase()}</Texto>
              </View>
              <View style={{ flex: 1 }}>
                <Texto v="fuerte">{s.cliente.nombre}</Texto>
                <Texto v="chico">{s.saldoCentavos > 0 && s.debeDesde ? `Debe desde el ${fecha(s.debeDesde)}` : 'Al día'}</Texto>
              </View>
              <Texto style={[e.saldo, s.saldoCentavos === 0 && { color: COLOR.texto3 }]}>{bs(s.saldoCentavos)}</Texto>
            </Tocable>
          </Aparecer>
        ))
      ) : (
        <View style={ui.vacio}>
          <Icono nombre="book-outline" tamano={20} color={COLOR.texto3} />
          <Texto v="gris" style={{ flex: 1 }}>
            Cuando vendas fiado desde «Vender», aquí ves quién te debe y cuánto.
          </Texto>
        </View>
      )}
      <HojaDeCliente saldo={elegido} alCerrar={() => setAbierto(null)} alAnotar={(cambios) => aplicar(cambios)} />
      <HojaDeClienteNuevo
        visible={nuevo}
        alCerrar={() => setNuevo(false)}
        alGuardar={async (nombre, telefono, debe) => {
          const c = clienteDeFiado(nombre, telefono, ahora(), nuevoId());
          await aplicar({ clientes: [c], fiados: debe ? [anotarFiado(c, 'DEBE', debe, 'Lo que ya debía', ahora(), nuevoId())] : [] });
          setNuevo(false);
        }}
      />
    </View>
  );
}

function HojaDeCliente({ saldo: s, alCerrar, alAnotar }: { saldo: SaldoDeFiado | null; alCerrar: () => void; alAnotar: (c: { fiados: ReturnType<typeof anotarFiado>[] }) => Promise<void> }) {
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  useEffect(() => {
    setMonto(s && s.saldoCentavos > 0 ? bsEnCampo(s.saldoCentavos) : '');
    setError(null);
    setListo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.cliente.id]);
  if (!s) return <HojaInferior visible={false}>{null}</HojaInferior>;

  const anotar = async (tipo: 'DEBE' | 'PAGA') => {
    const centavos = leerBs(monto);
    if (Number.isNaN(centavos) || centavos <= 0) return setError('Escribe el monto, por ejemplo 20 o 15,50');
    try {
      await alAnotar({ fiados: [anotarFiado(s.cliente, tipo, centavos, null, ahora(), nuevoId())] });
      setError(null);
      setMonto('');
      setListo(tipo === 'PAGA' ? `Anotamos que pagó ${bs(centavos)}` : `Anotamos que debe ${bs(centavos)} más`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo anotar');
    }
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <ContenidoDeHoja>
        <View style={{ gap: 2 }}>
          <Texto v="t2">{s.cliente.nombre}</Texto>
          <Texto v="gris">{s.saldoCentavos > 0 ? `Te debe ${bs(s.saldoCentavos)}` : 'Está al día'}</Texto>
        </View>
        <Campo etiqueta="Monto (Bs)" valor={monto} alCambiar={setMonto} teclado="decimal-pad" ejemplo="0,00" />
        {error && <Falla texto={error} />}
        {listo && <Listo texto={listo} />}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Boton texto="Pagó" icono="checkmark" alTocar={() => void anotar('PAGA')} />
          </View>
          <View style={{ flex: 1 }}>
            <Boton tipo="secundario" texto="Debe más" icono="add" alTocar={() => void anotar('DEBE')} />
          </View>
        </View>
        {s.cliente.telefono && s.saldoCentavos > 0 && (
          <Boton
            tipo="secundario"
            texto="Recordarle por WhatsApp"
            icono="logo-whatsapp"
            alTocar={() => void Linking.openURL(`https://wa.me/591${s.cliente.telefono}?text=${encodeURIComponent(`Hola ${s.cliente.nombre}, te recuerdo que tienes pendiente ${bs(s.saldoCentavos)}. ¡Gracias!`)}`)}
          />
        )}
        <Texto v="fuerte">Movimientos</Texto>
        {s.movimientos.map((m) => (
          <View key={m.id} style={e.movimiento}>
            <Icono nombre={m.tipo === 'PAGA' ? 'arrow-down-circle' : 'arrow-up-circle'} tamano={20} color={m.tipo === 'PAGA' ? COLOR.bosque : COLOR.ambarTexto} />
            <Texto style={{ flex: 1 }}>{m.tipo === 'PAGA' ? 'Pagó' : m.ventaId ? 'Compra fiada' : (m.nota ?? 'Debe')}</Texto>
            <Texto v="chico">{fecha(m.fecha)}</Texto>
            <Texto style={[e.montoMov, m.tipo === 'PAGA' && { color: COLOR.bosque }]}>
              {m.tipo === 'PAGA' ? '−' : '+'} {bs(m.montoCentavos)}
            </Texto>
          </View>
        ))}
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

function HojaDeClienteNuevo({ visible, alCerrar, alGuardar }: { visible: boolean; alCerrar: () => void; alGuardar: (nombre: string, telefono: string | null, debeCentavos: number | null) => Promise<void> }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [debe, setDebe] = useState('');
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    const centavos = debe.trim() ? leerBs(debe) : null;
    if (centavos !== null && Number.isNaN(centavos)) return setError('Revisa el monto');
    try {
      await alGuardar(nombre, telefono || null, centavos);
      setNombre('');
      setTelefono('');
      setDebe('');
      setError(null);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'No se pudo guardar');
    }
  };
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <ContenidoDeHoja>
        <Texto v="t2">Anotar a alguien</Texto>
        <Campo etiqueta="Nombre" valor={nombre} alCambiar={setNombre} ejemplo="Don Pedro" mayusculas />
        <Campo etiqueta="Celular (opcional, para recordarle)" valor={telefono} alCambiar={setTelefono} teclado="phone-pad" ejemplo="71234567" />
        <Campo etiqueta="Lo que ya te debe (opcional, Bs)" valor={debe} alCambiar={setDebe} teclado="decimal-pad" ejemplo="0,00" />
        {error && <Falla texto={error} />}
        <Boton tipo="oscuro" texto="Guardar" icono="checkmark" alTocar={() => void guardar()} />
      </ContenidoDeHoja>
    </HojaInferior>
  );
}

const e = StyleSheet.create({
  inicial: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLOR.limaSuave, alignItems: 'center', justifyContent: 'center' },
  textoInicial: { fontFamily: FUENTE.negra, fontSize: 18, color: COLOR.bosque },
  saldo: { fontFamily: FUENTE.negra, fontSize: 16, color: COLOR.ambarTexto },
  movimiento: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLOR.borde },
  montoMov: { minWidth: 90, textAlign: 'right', fontFamily: FUENTE.fuerte, color: COLOR.ambarTexto },
});
