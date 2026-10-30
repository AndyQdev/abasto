import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HojaInferior, Tocable, vibrar } from './animacion';
import { Boton, Icono, Texto } from './componentes';
import { iconoDeEtiqueta } from './direcciones';
import { useDirecciones } from './direcciones-estado';
import { COLOR } from './tema';

/** «Confirma tu dirección», como en PedidosYa: sale al abrir la app y al tocar la dirección del encabezado. */
export function HojaDeDirecciones({ visible, alCerrar, alNueva }: { visible: boolean; alCerrar: () => void; alNueva: () => void }) {
  const { lista, elegida, confirmar } = useDirecciones();
  const [marcada, setMarcada] = useState(elegida?.id ?? null);
  useEffect(() => {
    if (visible) setMarcada(elegida?.id ?? null);
  }, [visible, elegida]);

  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <Texto v="t1" style={{ textAlign: 'center', marginBottom: 14 }}>
        Confirma tu dirección
      </Texto>
      <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 4 }}>
        {lista.map((d) => {
          const activa = d.id === marcada;
          return (
            <Tocable
              key={d.id}
              hundir={0.98}
              onPress={() => setMarcada(d.id)}
              style={[e.fila, activa && e.filaActiva]}
              accessibilityRole="radio"
              accessibilityState={{ checked: activa }}
            >
              <View style={[e.icono, activa && { backgroundColor: COLOR.verde }]}>
                <Icono nombre={activa ? iconoDeEtiqueta(d.etiqueta) : (`${iconoDeEtiqueta(d.etiqueta)}-outline` as const)} color={activa ? '#fff' : COLOR.texto} tamano={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Texto v="fuerte">{d.etiqueta}</Texto>
                <Texto v="gris" lineas={1}>
                  {[d.calle, d.zona].filter(Boolean).join(' · ')}
                </Texto>
              </View>
              {activa && <Icono nombre="checkmark-circle" color={COLOR.verde} tamano={24} />}
            </Tocable>
          );
        })}
      </ScrollView>
      <View style={{ gap: 10, marginTop: 16 }}>
        <Boton
          texto="Confirmar"
          deshabilitado={!marcada}
          alTocar={() => {
            if (!marcada) return;
            confirmar(marcada);
            vibrar.exito();
            alCerrar();
          }}
        />
        <Boton texto="Nueva dirección" tipo="secundario" icono="add" alTocar={alNueva} />
      </View>
    </HojaInferior>
  );
}

const e = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 16 },
  filaActiva: { backgroundColor: COLOR.verdeSuave },
  icono: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLOR.tenue, alignItems: 'center', justifyContent: 'center' },
});
