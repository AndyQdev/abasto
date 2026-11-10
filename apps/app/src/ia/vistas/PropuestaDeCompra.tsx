import { cantidadConUnidad, itemDeCarrito, type ItemDeCarrito } from '@abasto/comercio';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Boton, Chip, Foto, Icono, Insignia, Tarjeta, Texto } from '../../componentes';
import { COLOR } from '../../tema';
import type { Propuesta } from '../entender/asistente';
import type { LineaPropuesta } from '../entender/catalogar';
import { NOMBRES_DE_PLATOS } from '../entender/foto';

const etiqueta = (l: LineaPropuesta) =>
  l.escala ? cantidadConUnidad({ cantidad: l.cantidad, presentacion: l.escala.presentacion, unidadesPorPresentacion: l.escala.cantidad }) : '';

/**
 * Lo que propone la IA (asistente o foto de comida/receta): el mensaje, los supuestos, cada producto con su cantidad
 * para marcar o desmarcar, lo que no tenemos y «Agregar al carrito». Nada entra al carrito sin que lo confirmes.
 * Se monta con `key` por propuesta: así lo desmarcado vuelve a cero con cada respuesta nueva.
 */
export function PropuestaDeCompra({
  propuesta,
  nombreDelModelo,
  alElegirPlato,
  alElegirReceta,
  alAgregar,
}: {
  propuesta: Propuesta;
  nombreDelModelo?: string | null;
  alElegirPlato?: (codigo: string) => void;
  alElegirReceta?: (id: string) => void;
  alAgregar: (items: ItemDeCarrito[]) => void;
}) {
  const [quitadas, setQuitadas] = useState<Set<number>>(new Set());
  const lineas = propuesta.lineas.filter((l) => l.producto && l.escala);
  const faltan = propuesta.lineas.filter((l) => !l.producto || !l.escala);
  const elegidas = lineas.filter((_, i) => !quitadas.has(i));

  return (
    <View style={{ gap: 12 }}>
      {propuesta.mensaje && (
        <Tarjeta style={estilos.mensaje}>
          <View style={estilos.fila}>
            <Icono nombre="sparkles" color={COLOR.bosque} />
            <Texto v="fuerte" style={{ flex: 1 }}>{propuesta.mensaje}</Texto>
          </View>
          {alElegirPlato && propuesta.lectura?.tipo === 'plato' && propuesta.lectura.opciones.length > 0 && (
            <View style={estilos.opciones}>
              {propuesta.lectura.opciones.map((o) => (
                <Chip key={o.codigo} texto={`${NOMBRES_DE_PLATOS[o.codigo] ?? o.codigo} · ${Math.round(o.confianza * 100)} %`} alTocar={() => alElegirPlato(o.codigo)} />
              ))}
            </View>
          )}
          {alElegirReceta && propuesta.variantes.length > 1 && (
            <View style={estilos.opciones}>
              {propuesta.variantes.map((r) => (
                <Chip key={r.id} texto={r.nombre} activo={r.id === propuesta.receta?.id} alTocar={() => alElegirReceta(r.id)} />
              ))}
            </View>
          )}
        </Tarjeta>
      )}

      {propuesta.supuestos.length > 0 && (
        <Tarjeta style={estilos.supuestos}>
          <Texto v="fuerte">Lo que supusimos</Texto>
          {propuesta.supuestos.map((s) => (
            <Texto key={s} v="chico">• {s}</Texto>
          ))}
        </Tarjeta>
      )}

      {lineas.map((l, i) => (
        <Tarjeta key={`${l.producto!.id}-${i}`} style={quitadas.has(i) ? { opacity: 0.45 } : undefined}>
          <View style={estilos.fila}>
            <Foto producto={l.producto!} alto={52} ancho={52} />
            <View style={{ flex: 1 }}>
              <Texto v="fuerte">{l.producto!.nombre}</Texto>
              <Texto v="gris">{etiqueta(l)}</Texto>
              {!!l.nota && <Texto v="chico">{l.nota}</Texto>}
            </View>
            {l.certeza === 'aproximada' && <Insignia texto="Revisa" color="ambar" />}
            <Pressable
              onPress={() => setQuitadas((q) => new Set(q.has(i) ? [...q].filter((x) => x !== i) : [...q, i]))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !quitadas.has(i) }}
              accessibilityLabel={`Llevar ${l.producto!.nombre}`}
            >
              <Icono nombre={quitadas.has(i) ? 'square-outline' : 'checkbox'} color={COLOR.bosque} />
            </Pressable>
          </View>
        </Tarjeta>
      ))}

      {faltan.length > 0 && (
        <Tarjeta>
          <Texto v="fuerte">No lo tenemos todavía</Texto>
          {faltan.map((l) => (
            <Texto key={l.pedido.nombre} v="chico">• {l.nota}</Texto>
          ))}
        </Tarjeta>
      )}

      {elegidas.length > 0 ? (
        <Boton
          tipo="oscuro"
          texto={`Agregar ${elegidas.length} ${elegidas.length === 1 ? 'producto' : 'productos'} al carrito`}
          alTocar={() => alAgregar(elegidas.map((l) => itemDeCarrito(l.producto!, l.escala!, l.cantidad)))}
        />
      ) : (
        !propuesta.supuestos.length && !propuesta.mensaje && <Texto v="gris">No encontramos productos para eso. Prueba con otras palabras.</Texto>
      )}
      <Texto v="chico">
        Entendió: {propuesta.origen === 'modelo' ? `la IA de tu teléfono${nombreDelModelo ? ` (${nombreDelModelo})` : ''}` : propuesta.origen === 'foto' ? 'el reconocedor de fotos de Abasto' : 'las reglas'}
        {propuesta.respuestaMs !== null ? ` · ${(propuesta.respuestaMs / 1000).toFixed(1).replace('.', ',')} s` : ''}
      </Texto>
      {propuesta.falloDelModelo &&
        (lineas.length ? (
          <Texto v="chico">La IA del teléfono no sumó nada esta vez ({propuesta.falloDelModelo.toLowerCase()}); el resultado es del reconocedor de Abasto.</Texto>
        ) : (
          <Texto v="chico" style={{ color: COLOR.rojoTexto }}>La IA del teléfono no pudo responder: {propuesta.falloDelModelo}</Texto>
        ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  supuestos: { backgroundColor: COLOR.ambarSuave },
  mensaje: { backgroundColor: COLOR.limaSuave, gap: 8 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
