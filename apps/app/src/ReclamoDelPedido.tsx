import { ABRIR_RECLAMO, MOTIVOS_DE_RECLAMO, puedeReclamar, reclamoEnPalabras, type MotivoDeReclamo, type Pedido, type ReclamoDePedido } from '@abasto/comercio';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { HojaInferior } from './animacion';
import { graphql } from './api';
import { Boton, Icono, Tarjeta, Texto } from './componentes';
import { ContenidoDeHoja, DosBotones, Opciones } from './mi-negocio/ui';
import { COLOR } from './tema';

/**
 * CU-16: «Tengo un problema con este pedido». Abasto lo revisa y lo resuelve a mano; aquí se ve la respuesta y, si
 * corresponde, lo que se devolvió. Pide señal: no es algo que convenga dejar en una cola sin avisar.
 */
export function ReclamoDelPedido({ pedido, alCambiar }: { pedido: Pedido; alCambiar: (reclamo: ReclamoDePedido) => void }) {
  const [abierta, setAbierta] = useState(false);
  const [motivo, setMotivo] = useState<MotivoDeReclamo | null>(null);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pedido.reclamo) {
    const { titulo, detalle: texto, respuesta, clase } = reclamoEnPalabras(pedido.reclamo);
    return (
      <Tarjeta style={{ gap: 6 }}>
        <View style={e.titulo}>
          <Icono nombre={clase === 'en-revision' ? 'time-outline' : clase === 'aprobado' ? 'checkmark-circle-outline' : 'close-circle-outline'} tamano={20} color={COLOR.texto} />
          <Texto v="t3">{titulo}</Texto>
        </View>
        {!!texto && <Texto v="gris">{texto}</Texto>}
        {!!respuesta && <Texto>{respuesta}</Texto>}
      </Tarjeta>
    );
  }
  if (!puedeReclamar(pedido)) return null;

  const falta = !motivo || (motivo === 'OTRO' && !detalle.trim());

  const enviar = async () => {
    if (!motivo) return;
    setEnviando(true);
    setError(null);
    try {
      const { abrirReclamo } = await graphql<{ abrirReclamo: ReclamoDePedido }>(ABRIR_RECLAMO, { entrada: { pedidoId: pedido.id, motivo, detalle: detalle.trim() || null } });
      setAbierta(false);
      alCambiar(abrirReclamo);
    } catch (err) {
      const mensaje = (err as Error).message;
      setError(mensaje === 'Network request failed' ? 'Necesitas señal para mandar tu reclamo. Vuelve a intentar cuando tengas conexión.' : mensaje);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Boton tipo="secundario" texto="Tengo un problema con este pedido" icono="help-circle-outline" alTocar={() => setAbierta(true)} />
      <HojaInferior visible={abierta} alCerrar={enviando ? undefined : () => setAbierta(false)}>
        <ContenidoDeHoja
          pie={
            <View style={{ gap: 8 }}>
              {!!error && (
                <Texto accessibilityRole="alert" style={{ color: COLOR.rojoTexto }}>
                  {error}
                </Texto>
              )}
              <DosBotones
                izquierda={<Boton tipo="secundario" texto="Cancelar" deshabilitado={enviando} alTocar={() => setAbierta(false)} />}
                derecha={<Boton tipo="oscuro" texto="Enviar" cargando={enviando} deshabilitado={falta} alTocar={() => void enviar()} />}
              />
            </View>
          }
        >
          <Texto v="t2">¿Qué pasó con tu pedido?</Texto>
          <Texto v="gris">{`Pedido ${pedido.codigo}. Lo revisamos y te respondemos aquí mismo.`}</Texto>
          <Opciones opciones={MOTIVOS_DE_RECLAMO} elegida={motivo as MotivoDeReclamo} alElegir={setMotivo} />
          <TextInput
            style={e.entrada}
            multiline
            maxLength={500}
            accessibilityLabel="Cuéntanos qué pasó"
            placeholder={motivo === 'OTRO' ? 'Cuéntanos qué pasó' : 'Cuéntanos más, si quieres'}
            placeholderTextColor={COLOR.texto3}
            value={detalle}
            onChangeText={setDetalle}
          />
        </ContenidoDeHoja>
      </HojaInferior>
    </>
  );
}

const e = StyleSheet.create({
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entrada: { minHeight: 88, padding: 14, borderRadius: 16, backgroundColor: COLOR.tenue, color: COLOR.texto, fontSize: 16, textAlignVertical: 'top' },
});
