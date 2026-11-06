import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Aparecer } from '../animacion';
import { Boton, Icono, Tarjeta, Texto } from '../componentes';
import { conectarTienda, direccionDeLaApi, direccionDelMcp, resultadoDeEntrega, ultimoUso, type Entrega, type Llave, type Webhook } from '../conectar-tienda';
import { useSesion } from '../sesion';
import { COLOR } from '../tema';

/** Algo que se muestra una sola vez: si no lo guarda ahora, tiene que sacar otro. */
function UnaSolaVez({ titulo, valor, alCerrar }: { titulo: string; valor: string; alCerrar: () => void }) {
  return (
    <View style={e.unaVez} accessibilityRole="alert">
      <Texto v="t3" style={{ color: COLOR.bosque }}>
        {titulo}
      </Texto>
      <Texto style={{ color: COLOR.bosque }}>Guárdala ahora: no la vas a volver a ver. No se la pases a nadie que no maneje tu tienda.</Texto>
      <Texto seleccionable style={e.valor}>
        {valor}
      </Texto>
      <Boton tipo="oscuro" texto="Copiar o compartir" icono="share-outline" alTocar={() => void Share.share({ message: valor })} />
      <Boton tipo="chico" texto="Ya la guardé" alTocar={alCerrar} />
    </View>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Texto v="chico" style={{ color: COLOR.texto3 }}>
        {titulo}
      </Texto>
      <Texto seleccionable style={e.dato}>
        {valor}
      </Texto>
    </View>
  );
}

/**
 * CU-10 · Conectar mi tienda en línea. Para quien además vende por internet: con una llave, los pedidos de su
 * WooCommerce (u otra tienda) llegan solos a Abasto, y Abasto le avisa cuando cambian.
 */
export function ConectarTienda() {
  const { token } = useSesion();
  const api = useMemo(() => conectarTienda(token), [token]);
  const [llaves, setLlaves] = useState<Llave[] | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [nombre, setNombre] = useState('');
  const [url, setUrl] = useState('');
  const [nuevaLlave, setNuevaLlave] = useState<string | null>(null);
  const [nuevoSecreto, setNuevoSecreto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [l, w, en] = await Promise.all([api.llaves(), api.webhooks(), api.entregas()]);
      setLlaves(l);
      setWebhooks(w);
      setEntregas(en);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setLlaves((actual) => actual ?? []);
    }
  }, [api]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const haciendo = async (hacer: () => Promise<void>) => {
    setOcupado(true);
    setError(null);
    try {
      await hacer();
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const crearLlave = () =>
    haciendo(async () => {
      const { llave } = await api.crearLlave(nombre.trim());
      setNuevaLlave(llave);
      setNombre('');
    });

  const crearWebhook = () =>
    haciendo(async () => {
      const { secreto } = await api.crearWebhook(url.trim());
      setNuevoSecreto(secreto);
      setUrl('');
    });

  const preguntarRevocar = (l: Llave) =>
    Alert.alert('¿Revocar esta llave?', `«${l.nombre}» deja de funcionar al momento y los pedidos de esa tienda dejan de entrar.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revocar', style: 'destructive', onPress: () => void haciendo(() => api.revocarLlave(l.id)) },
    ]);

  const preguntarBorrar = (w: Webhook) =>
    Alert.alert('¿Borrar esta dirección?', w.url, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => void haciendo(() => api.borrarWebhook(w.id)) },
    ]);

  const avisoDe = (w: Webhook) => entregas.find((en) => en.webhookId === w.id);

  return (
    <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
      <Aparecer>
        <Texto v="gris">Si vendes por internet, los pedidos de tu tienda en línea pueden llegar solos a Abasto, sin copiarlos a mano. Nunca entran dos veces.</Texto>
      </Aparecer>

      {!!error && (
        <View style={e.falla} accessibilityRole="alert">
          <Icono nombre="alert-circle-outline" tamano={20} color={COLOR.rojoTexto} />
          <Texto style={{ flex: 1, color: COLOR.rojoTexto }}>{error}</Texto>
        </View>
      )}

      {!!nuevaLlave && <UnaSolaVez titulo="Tu llave nueva" valor={nuevaLlave} alCerrar={() => setNuevaLlave(null)} />}
      {!!nuevoSecreto && <UnaSolaVez titulo="La clave para comprobar los avisos" valor={nuevoSecreto} alCerrar={() => setNuevoSecreto(null)} />}

      <Aparecer orden={1} style={{ gap: 10 }}>
        <Texto v="t3">Tus llaves</Texto>
        {llaves === null && <Texto v="gris">Cargando…</Texto>}
        {llaves?.length === 0 && <Texto v="gris">Todavía no tienes llaves. Saca una para tu tienda en línea.</Texto>}
        {llaves?.map((l) => (
          <Tarjeta key={l.id} style={e.fila}>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto style={{ fontWeight: '800' }}>{l.nombre}</Texto>
              <Texto v="chico" style={{ color: COLOR.texto3 }}>
                Termina en {l.termina} · {ultimoUso(l.ultimoUsoEn)}
              </Texto>
            </View>
            <Boton tipo="chico" texto="Revocar" deshabilitado={ocupado} alTocar={() => preguntarRevocar(l)} />
          </Tarjeta>
        ))}
        <TextInput
          style={e.entrada}
          placeholder="Nombre, por ejemplo: Mi WooCommerce"
          placeholderTextColor={COLOR.texto3}
          accessibilityLabel="Nombre de la llave"
          maxLength={60}
          value={nombre}
          onChangeText={setNombre}
        />
        <Boton tipo="primario" texto="Sacar una llave" icono="key-outline" cargando={ocupado} deshabilitado={nombre.trim().length < 2} alTocar={() => void crearLlave()} />
      </Aparecer>

      <Aparecer orden={2} style={{ gap: 10 }}>
        <Texto v="t3">Avisos a tu tienda</Texto>
        <Texto v="gris">Te avisamos a tu tienda en línea cuando un pedido cambia: confirmado, despachado, entregado.</Texto>
        {webhooks.map((w) => {
          const aviso = avisoDe(w);
          return (
            <Tarjeta key={w.id} style={{ gap: 8 }}>
              <Texto seleccionable lineas={2} style={{ fontWeight: '800' }}>
                {w.url}
              </Texto>
              {!!aviso && <Texto v="chico">{resultadoDeEntrega(aviso)}</Texto>}
              <View style={e.acciones}>
                <View style={{ flex: 1 }}>
                  <Boton tipo="secundario" texto="Probar" deshabilitado={ocupado} alTocar={() => void haciendo(async () => void (await api.probarWebhook(w.id)))} />
                </View>
                {aviso?.estado === 'fallida' && (
                  <View style={{ flex: 1 }}>
                    <Boton tipo="secundario" texto="Reenviar" deshabilitado={ocupado} alTocar={() => void haciendo(async () => void (await api.reenviar(aviso.id)))} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Boton tipo="chico" texto="Borrar" deshabilitado={ocupado} alTocar={() => preguntarBorrar(w)} />
                </View>
              </View>
            </Tarjeta>
          );
        })}
        <TextInput
          style={e.entrada}
          placeholder="https://mitienda.bo/avisos"
          placeholderTextColor={COLOR.texto3}
          accessibilityLabel="Dirección de tu tienda"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={url}
          onChangeText={setUrl}
        />
        <Boton tipo="secundario" texto="Agregar dirección" icono="add" deshabilitado={ocupado || url.trim().length < 8} alTocar={() => void crearWebhook()} />
      </Aparecer>

      <Aparecer orden={3}>
        <Tarjeta style={{ gap: 12 }}>
          <Texto v="t3">Cómo conectarla</Texto>
          <View style={{ gap: 2 }}>
            <Texto style={{ fontWeight: '800' }}>WooCommerce</Texto>
            <Texto v="gris">Instala el plugin de Abasto en tu WordPress y pega tu llave en WooCommerce › Abasto.</Texto>
          </View>
          <View style={{ gap: 6 }}>
            <Texto style={{ fontWeight: '800' }}>Otra tienda en línea</Texto>
            <Texto v="gris">Pásale esto a quien maneja tu tienda:</Texto>
            <Dato titulo="Dirección de la API" valor={direccionDeLaApi()} />
          </View>
          <View style={{ gap: 6 }}>
            <Texto style={{ fontWeight: '800' }}>Un agente de IA</Texto>
            <Texto v="gris">Un asistente con MCP puede buscar y comprar por ti, con tu llave.</Texto>
            <Dato titulo="Dirección MCP" valor={direccionDelMcp()} />
          </View>
        </Tarjeta>
      </Aparecer>
    </ScrollView>
  );
}

const e = StyleSheet.create({
  contenido: { padding: 16, gap: 18, paddingBottom: 40 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  acciones: { flexDirection: 'row', gap: 8 },
  entrada: { minHeight: 48, borderRadius: 16, paddingHorizontal: 14, backgroundColor: '#fff', color: COLOR.texto, fontSize: 16 },
  unaVez: { gap: 10, padding: 16, borderRadius: 24, backgroundColor: COLOR.lima },
  valor: { padding: 12, borderRadius: 14, backgroundColor: '#fff', color: COLOR.texto, fontSize: 14, fontWeight: '700' },
  dato: { padding: 10, borderRadius: 12, backgroundColor: COLOR.tenue, color: COLOR.texto, fontSize: 13 },
  falla: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: COLOR.rojoSuave },
});
