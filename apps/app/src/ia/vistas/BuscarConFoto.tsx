import { buscarPorTextoLeido, palabrasClave, type ItemDeCarrito, type Producto } from '@abasto/comercio';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Boton, Falla, Icono, Tarjeta, Texto } from '../../componentes';
import { COLOR } from '../../tema';
import { proponerCompra, type Propuesta } from '../entender/asistente';
import { candidatos } from '../entender/catalogar';
import { useIaLocal } from '../local/estado';
import { bytesDe, megas, type ModeloLocal } from '../local/modelos';
import { CONFIANZA_MINIMA, productosPorFoto, type Reconocido } from '../parecido';
import { leerTexto, reconocerFoto } from '../perezoso';
import { PropuestaDeCompra } from './PropuestaDeCompra';

/** Qué quiere reconocer la persona: enfoca al reconocedor y cambia lo que se muestra. */
export type QueReconocer = 'producto' | 'comida' | 'receta';

const OPCIONES: { id: QueReconocer; texto: string; icono: 'cube-outline' | 'restaurant-outline' | 'document-text-outline'; titulo: string; detalle: string }[] = [
  {
    id: 'producto',
    texto: 'Producto',
    icono: 'cube-outline',
    titulo: 'Sácale una foto al producto o a su etiqueta',
    detalle: 'Te mostramos dónde comprarlo al por mayor.',
  },
  {
    id: 'comida',
    texto: 'Comida',
    icono: 'restaurant-outline',
    titulo: 'Sácale una foto al plato',
    detalle: 'Te decimos qué es y qué comprar para prepararlo.',
  },
  {
    id: 'receta',
    texto: 'Receta',
    icono: 'document-text-outline',
    titulo: 'Sácale una foto a tu receta o lista',
    detalle: 'O escríbela abajo. Te armamos la compra con las cantidades.',
  },
];

const tamano = (m: ModeloLocal) => {
  const mb = megas(bytesDe(m));
  return mb >= 1000 ? `${(mb / 1000).toFixed(1).replace('.', ',')} GB` : `${mb} MB`;
};

type Resultado =
  | { tipo: 'productos'; productos: Producto[]; parecidos: Producto[]; leido: string; deLaIa: string[] }
  | { tipo: 'propuesta'; propuesta: Propuesta };

/**
 * Buscar con una foto (una sola pantalla para la cámara del Inicio y la de Buscar, 10/11):
 * - ¿Qué quieres reconocer? Producto, comida o receta.
 * - «Usar la IA de tu teléfono»: suma el modelo de lenguaje local (llama.rn); si no hay uno bajado, ofrece bajarlo.
 * Sin la IA anda igual: MobileNetV3 + vectores, ML Kit y las reglas, todo dentro del teléfono y sin internet.
 */
export function BuscarConFoto({
  productos,
  negocio,
  alAgregar,
  alBuscarEscribiendo,
  alElegirModelo,
  mostrarProducto,
}: {
  productos: Producto[];
  negocio?: string | null;
  alAgregar: (items: ItemDeCarrito[]) => void;
  alBuscarEscribiendo: () => void;
  alElegirModelo: () => void;
  /** Cómo se ve un producto encontrado (la pantalla pone su tarjeta con «+») */
  mostrarProducto: (producto: Producto) => ReactNode;
}) {
  const ia = useIaLocal();
  const [que, setQue] = useState<QueReconocer>('producto');
  const [foto, setFoto] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [vez, setVez] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const opcion = OPCIONES.find((o) => o.id === que)!;
  const conIa = ia.usarIa && !!ia.activo;

  // Con la IA prendida, el modelo empieza a cargar mientras la persona saca la foto
  useEffect(() => {
    if (conIa) void ia.interprete();
  }, [conIa, ia.interprete]);

  function cambiarQue(nuevo: QueReconocer) {
    setQue(nuevo);
    setResultado(null);
    setError(null);
  }

  async function elegir(desde: 'camara' | 'galeria') {
    setError(null);
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    if (desde === 'camara') {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) return setError('Abasto necesita la cámara para buscar con una foto. Actívala en los ajustes del teléfono.');
    }
    const r = desde === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (r.canceled || !r.assets[0]) return;
    setFoto(r.assets[0].uri);
    // La receta puede llevar además texto: se reconoce al tocar «Armar mi compra»
    if (que !== 'receta') await reconocer(r.assets[0].uri);
  }

  async function reconocer(uri: string | null, eleccion: { platoElegido?: string; recetaElegida?: string } = {}) {
    setTrabajando(true);
    setError(null);
    if (!eleccion.platoElegido && !eleccion.recetaElegida) setResultado(null);
    try {
      const interprete = conIa ? await ia.interprete() : null;
      if (que === 'producto') {
        if (!uri) return;
        setResultado(await buscarProducto(uri, interprete));
      } else {
        // Comida: solo los platos del reconocedor. Receta: lo que lee ML Kit en la foto más lo escrito.
        const leido = que === 'receta' && uri ? await leerTexto(uri).catch(() => '') : '';
        const propuesta = await proponerCompra(
          { texto: [texto, leido].filter((t) => t.trim()).join('\n'), fotoUri: que === 'comida' || interprete ? uri : null },
          productos,
          {
            interprete,
            contexto: { negocio },
            reconocerFoto: que === 'comida' ? async (u) => ({ ...(await reconocerFoto(u)), productos: [] }) : undefined,
            platoElegido: eleccion.platoElegido ?? (eleccion.recetaElegida && resultado?.tipo === 'propuesta' && resultado.propuesta.lectura?.tipo === 'plato' ? resultado.propuesta.lectura.plato : null),
            recetaElegida: eleccion.recetaElegida ?? null,
          },
        );
        setResultado({ tipo: 'propuesta', propuesta });
      }
      setVez((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  }

  async function buscarProducto(uri: string, interprete: Awaited<ReturnType<typeof ia.interprete>>): Promise<Resultado> {
    // La etiqueta (ML Kit), cómo se ve (MobileNetV3 + vectores) y, si está prendida, la IA del teléfono: los tres juntos
    let fallaDelReconocedor: string | null = null;
    const [leido, porImagen, deLaIa] = await Promise.all([
      leerTexto(uri).catch(() => ''),
      reconocerFoto(uri, 10)
        .then((r) => r.productos)
        .catch((e: Error) => {
          fallaDelReconocedor = e.message;
          console.warn('[ia] el reconocedor de fotos falló:', e.message);
          return [] as Reconocido[];
        }),
      interprete?.veFotos
        ? interprete
            .interpretar({ texto: '¿Qué producto es este? Pon en items solo el producto que se ve, con su presentación.', fotoUri: uri }, { negocio })
            .then((i) => (i?.items ?? []).map((x) => x.nombre))
            .catch(() => [] as string[])
        : Promise.resolve([] as string[]),
    ]);
    if (fallaDelReconocedor && !leido) throw new Error(`No se pudo leer la foto: ${fallaDelReconocedor}`);
    const porCodigo = new Map(productos.map((p) => [p.codigo, p] as const));
    // Lo que nombró la IA va primero; después lo que juntan la imagen y la etiqueta
    const dichos = deLaIa.flatMap((n) => candidatos(n, productos).slice(0, 2));
    const encontrados = [...new Map([...dichos, ...productosPorFoto(productos, porImagen, buscarPorTextoLeido(productos, leido))].map((p) => [p.id, p] as const)).values()].slice(0, 10);
    // Si nada pasó el umbral, igual se muestran los más parecidos como «¿Es alguno de estos?»
    const parecidos = encontrados.length
      ? []
      : porImagen
          .filter((r) => r.confianza < CONFIANZA_MINIMA)
          .slice(0, 3)
          .map((r) => porCodigo.get(r.codigo))
          .filter((p): p is Producto => !!p);
    return { tipo: 'productos', productos: encontrados, parecidos, leido, deLaIa };
  }

  const claves = resultado?.tipo === 'productos' ? palabrasClave(resultado.leido) : [];

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <Texto v="fuerte">¿Qué quieres reconocer?</Texto>
        <View style={e.opciones}>
          {OPCIONES.map((o) => {
            const activa = o.id === que;
            return (
              <Pressable
                key={o.id}
                onPress={() => cambiarQue(o.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
                style={[e.opcion, activa && e.opcionActiva]}
              >
                <Icono nombre={o.icono} tamano={22} color={COLOR.bosque} />
                <Texto v="fuerte" style={{ fontSize: 14 }}>{o.texto}</Texto>
              </Pressable>
            );
          })}
        </View>
      </View>

      <InterruptorDeIa alElegirModelo={alElegirModelo} />

      <View style={e.marco}>
        {foto ? (
          <>
            <Image source={{ uri: foto }} style={e.foto} accessibilityLabel="Tu foto" />
            <Pressable onPress={() => { setFoto(null); setResultado(null); }} style={e.quitar} accessibilityRole="button" accessibilityLabel="Quitar la foto">
              <Icono nombre="close-circle" tamano={28} color={COLOR.superficie} />
            </Pressable>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Icono nombre={opcion.icono} tamano={52} color={COLOR.verde} />
            <Texto v="fuerte" style={{ textAlign: 'center' }}>{opcion.titulo}</Texto>
            <Texto v="gris" style={{ textAlign: 'center' }}>{opcion.detalle}</Texto>
          </View>
        )}
      </View>
      <View style={e.botones}>
        <View style={{ flex: 1 }}>
          <Boton texto="Tomar foto" icono="camera-outline" alTocar={() => void elegir('camara')} cargando={trabajando && que !== 'receta'} />
        </View>
        <View style={{ flex: 1 }}>
          <Boton tipo="secundario" texto="Galería" icono="images-outline" alTocar={() => void elegir('galeria')} />
        </View>
      </View>

      {que === 'receta' && (
        <Tarjeta>
          <TextInput
            style={e.entrada}
            multiline
            value={texto}
            onChangeText={setTexto}
            placeholder={'Ej.: 3 cajas de aceite, 2 fardos de arroz\no «quiero hacer 300 salteñas»'}
            placeholderTextColor={COLOR.texto3}
            accessibilityLabel="Tu receta o lista"
          />
          <Boton
            texto={trabajando ? 'Armando tu compra…' : 'Armar mi compra'}
            icono="sparkles-outline"
            cargando={trabajando}
            deshabilitado={!texto.trim() && !foto}
            alTocar={() => void reconocer(foto)}
          />
        </Tarjeta>
      )}

      {error && <Falla texto={error} />}
      {trabajando && (
        <Texto v="gris">
          {conIa ? `La IA de tu teléfono (${ia.activo!.nombre}) está mirando la foto…` : 'Leyendo la foto en tu teléfono…'}
        </Texto>
      )}

      {resultado?.tipo === 'productos' && (
        <View style={{ gap: 10 }}>
          {claves.length > 0 && (
            <Texto v="gris">
              Leímos: <Texto v="fuerte">{claves.join(', ')}</Texto>
            </Texto>
          )}
          {resultado.deLaIa.length > 0 && (
            <Texto v="gris">
              La IA vio: <Texto v="fuerte">{resultado.deLaIa.join(', ')}</Texto>
            </Texto>
          )}
          {resultado.productos.length > 0 && <Texto v="fuerte">Lo que encontramos</Texto>}
          {resultado.productos.slice(0, 1).map((p) => (
            <View key={p.id}>{mostrarProducto(p)}</View>
          ))}
          {resultado.productos.length > 1 && <Texto v="gris">También puede ser</Texto>}
          {resultado.productos.slice(1, 5).map((p) => (
            <View key={p.id}>{mostrarProducto(p)}</View>
          ))}
          {!resultado.productos.length && resultado.parecidos.length > 0 && (
            <>
              <Texto v="fuerte">No estamos seguros. ¿Es alguno de estos?</Texto>
              {resultado.parecidos.map((p) => (
                <View key={p.id}>{mostrarProducto(p)}</View>
              ))}
            </>
          )}
          {!resultado.productos.length && !resultado.parecidos.length && (
            <Tarjeta style={{ alignItems: 'center', gap: 8 }}>
              <Texto v="fuerte">No encontramos ese producto</Texto>
              <Texto v="gris" style={{ textAlign: 'center' }}>
                Prueba más cerca y con buena luz, que se lea el nombre{!conIa ? ', o prende la IA de tu teléfono' : ''}.
              </Texto>
              <Boton tipo="chico" texto="Buscar escribiendo" alTocar={alBuscarEscribiendo} />
            </Tarjeta>
          )}
        </View>
      )}

      {resultado?.tipo === 'propuesta' && (
        <PropuestaDeCompra
          key={vez}
          propuesta={resultado.propuesta}
          nombreDelModelo={ia.activo?.nombre}
          alElegirPlato={(codigo) => void reconocer(foto, { platoElegido: codigo })}
          alElegirReceta={(id) => void reconocer(foto, { recetaElegida: id })}
          alAgregar={alAgregar}
        />
      )}
    </View>
  );
}

/**
 * «Usar la IA de tu teléfono». Prendida sin modelo bajado: pide bajar el que le toca al teléfono (una vez, mejor con
 * Wi-Fi) o elegir uno ya bajado. Apagada: el reconocedor propio y las reglas, que andan en cualquier teléfono.
 */
function InterruptorDeIa({ alElegirModelo }: { alElegirModelo: () => void }) {
  const ia = useIaLocal();
  const bajado = ia.posibles.find((m) => ia.instalados.includes(m.id)) ?? null;
  const bajando = ia.progreso;

  return (
    <Tarjeta style={{ gap: 10 }}>
      <View style={e.fila}>
        <Icono nombre="sparkles" color={COLOR.bosque} />
        <View style={{ flex: 1 }}>
          <Texto v="fuerte">Usar la IA de tu teléfono</Texto>
          <Texto v="chico">
            {ia.usarIa && ia.activo
              ? `${ia.activo.nombre}${ia.cargando ? ' · preparándose…' : ' · lista, sin internet'}`
              : 'Entiende mejor fotos difíciles, platos y recetas escritas a mano.'}
          </Texto>
        </View>
        <Switch
          value={ia.usarIa}
          onValueChange={ia.cambiarUsarIa}
          trackColor={{ false: COLOR.borde, true: COLOR.bosque }}
          thumbColor={ia.usarIa ? COLOR.lima : COLOR.superficie}
          accessibilityLabel="Usar la IA de tu teléfono"
        />
      </View>

      {ia.usarIa && !ia.activo && (
        <View style={e.aviso}>
          {bajando ? (
            <>
              <Texto v="chico">Bajando el modelo {Math.round(bajando.fraccion * 100)} % · {megas(bajando.bajados)} de {megas(bajando.total)} MB</Texto>
              <View style={e.barra}>
                <View style={[e.relleno, { width: `${Math.round(bajando.fraccion * 100)}%` }]} />
              </View>
              <Boton tipo="secundario" texto="Cancelar" alTocar={() => void ia.cancelar()} />
            </>
          ) : bajado ? (
            <>
              <Texto v="chico">Ya tienes {bajado.nombre} en tu teléfono.</Texto>
              <Boton tipo="chico" texto={`Usar ${bajado.nombre}`} alTocar={() => void ia.usar(bajado)} />
            </>
          ) : ia.recomendado ? (
            <>
              <Texto v="chico">
                Para usar la IA tienes que bajar un modelo a tu teléfono, una sola vez ({tamano(ia.recomendado)}, mejor con Wi-Fi). Después anda sin internet.
              </Texto>
              <Boton texto={`Bajar ${ia.recomendado.nombre} (${tamano(ia.recomendado)})`} icono="cloud-download-outline" alTocar={() => void ia.descargar(ia.recomendado!)} />
              <Pressable onPress={alElegirModelo} accessibilityRole="button">
                <Texto v="chico" style={{ textDecorationLine: 'underline' }}>Elegir otro modelo</Texto>
              </Pressable>
            </>
          ) : (
            <Texto v="chico">Tu teléfono no tiene memoria o espacio para un modelo de IA. Sigues buscando con el reconocedor de Abasto.</Texto>
          )}
        </View>
      )}
      {ia.usarIa && ia.error && <Texto v="chico" style={{ color: COLOR.rojoTexto }}>{ia.error}</Texto>}
    </Tarjeta>
  );
}

const e = StyleSheet.create({
  opciones: { flexDirection: 'row', gap: 8 },
  opcion: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR.borde,
    backgroundColor: COLOR.superficie,
  },
  opcionActiva: { backgroundColor: COLOR.lima, borderColor: COLOR.bosque },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aviso: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: COLOR.limaSuave },
  barra: { height: 8, borderRadius: 4, backgroundColor: COLOR.superficie, overflow: 'hidden' },
  relleno: { height: 8, backgroundColor: COLOR.bosque },
  marco: { height: 240, borderRadius: 24, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde, alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' },
  foto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  quitar: { position: 'absolute', top: 10, right: 10 },
  botones: { flexDirection: 'row', gap: 10 },
  entrada: {
    minHeight: 90,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.borde,
    backgroundColor: COLOR.tenue,
    color: COLOR.texto,
    textAlignVertical: 'top',
  },
});
