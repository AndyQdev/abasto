import { NEGOCIOS, TIPOS_DE_NEGOCIO, esTipoDeNegocio, type PedidoDeLaSemana, type TipoDeNegocio } from '@abasto/comercio';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tocable } from './animacion';
import { Boton, Icono, Texto, type NombreDeIcono } from './componentes';
import { guardado } from './guardado';
import { ILUSTRACION } from './ilustraciones';
import { COLOR, FUENTE, SOMBRA } from './tema';

/**
 * El Inicio según el negocio (01/11): el cliente elige si es tienda, salteñería-panadería o pensión-restaurante y
 * la app le muestra primero lo suyo. La elección se guarda en el teléfono y se cambia con los chips de arriba.
 */
const ICONO: Record<TipoDeNegocio, NombreDeIcono> = { tienda: 'storefront', masas: 'pizza', cocina: 'restaurant' };

/** El negocio guardado; `leido` evita mostrar la pregunta un instante a quien ya eligió */
export function useNegocio() {
  const [tipo, setTipo] = useState<TipoDeNegocio | null>(null);
  const [leido, setLeido] = useState(false);
  useEffect(() => {
    void guardado.leer<string>('negocio').then((v) => {
      if (esTipoDeNegocio(v)) setTipo(v);
      setLeido(true);
    });
  }, []);
  const elegir = (t: TipoDeNegocio) => {
    setTipo(t);
    void guardado.escribir('negocio', t);
  };
  return { tipo, leido, elegir };
}

/** La primera vez: «¿Qué negocio tienes?» con las tres opciones grandes */
export function ElegirNegocio({ alElegir }: { alElegir: (t: TipoDeNegocio) => void }) {
  return (
    <View style={e.carta}>
      <View style={{ gap: 2 }}>
        <Texto style={e.pregunta}>¿Qué negocio tienes?</Texto>
        <Texto v="gris">Te mostramos primero lo que usas cada semana.</Texto>
      </View>
      {TIPOS_DE_NEGOCIO.map((t) => (
        <Tocable key={t} onPress={() => alElegir(t)} style={e.opcion} accessibilityRole="button" accessibilityLabel={NEGOCIOS[t].nombre}>
          <View style={e.iconoOpcion}>
            <Icono nombre={ICONO[t]} tamano={22} color={COLOR.bosque} />
          </View>
          <View style={{ flex: 1 }}>
            <Texto v="fuerte">{NEGOCIOS[t].nombre}</Texto>
            <Texto v="chico" lineas={1}>
              {NEGOCIOS[t].ejemplo}
            </Texto>
          </View>
          <Icono nombre="chevron-forward" tamano={18} color={COLOR.texto3} />
        </Tocable>
      ))}
    </View>
  );
}

/** Después de elegir: tres chips para cambiar de negocio sin salir del Inicio */
export function ChipsDeNegocio({ tipo, alElegir }: { tipo: TipoDeNegocio; alElegir: (t: TipoDeNegocio) => void }) {
  return (
    <View style={e.chips} accessibilityRole="tablist">
      {TIPOS_DE_NEGOCIO.map((t) => {
        const activo = t === tipo;
        return (
          <Tocable
            key={t}
            onPress={() => alElegir(t)}
            style={[e.chip, activo && e.chipActivo]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={NEGOCIOS[t].nombre}
          >
            <Icono nombre={ICONO[t]} tamano={16} color={activo ? COLOR.lima : COLOR.bosque} />
            <Texto style={[e.textoChip, activo && { color: COLOR.lima }]} lineas={1}>
              {NEGOCIOS[t].corto}
            </Texto>
          </Tocable>
        );
      })}
    </View>
  );
}

/** La promesa nueva de Abasto, en lugar de «más barato que el súper» */
export function SinIrAlMercado({ horas }: { horas: number }) {
  const cuando = horas <= 24 ? 'te llega mañana' : `te llega en ${horas} h`;
  return (
    <View style={e.mercado}>
      <View style={{ flex: 1, gap: 4 }}>
        <Texto style={e.tituloMercado}>No vuelvas a ir al mercado</Texto>
        <Texto style={e.textoMercado}>Compramos por ti en Los Pozos y La Ramada y te lo llevamos. Pides hoy, {cuando} a tu puerta.</Texto>
      </View>
      <Image source={ILUSTRACION.bannerEntrega} style={e.imagenMercado} contentFit="contain" />
    </View>
  );
}

/** «Tu pedido de la semana»: el último pedido, para repetirlo de un toque */
export function PedidoDeLaSemanaCarta({ pedido, alRepetir }: { pedido: PedidoDeLaSemana; alRepetir: () => void }) {
  const [a, m, d] = pedido.creadoEn.slice(0, 10).split('-');
  const n = pedido.items.length;
  return (
    <View style={e.carta}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Image source={ILUSTRACION.comprarOtraVez} style={{ width: 64, height: 64 }} contentFit="contain" />
        <View style={{ flex: 1, gap: 2 }}>
          <Texto style={e.pregunta}>Tu pedido de la semana</Texto>
          <Texto v="gris">
            Lo mismo que el {pedido.codigo} del {d}/{m}/{a}: {n} {n === 1 ? 'producto' : 'productos'} · {pedido.totalTexto}
          </Texto>
        </View>
      </View>
      {pedido.faltan.length > 0 && (
        <Texto v="chico">
          Ya no vendemos: {pedido.faltan.join(', ')}.
        </Texto>
      )}
      <Boton texto="Pedir lo mismo" icono="repeat" alTocar={alRepetir} />
    </View>
  );
}

const e = StyleSheet.create({
  carta: { gap: 12, padding: 16, borderRadius: 24, backgroundColor: COLOR.superficie, ...SOMBRA },
  pregunta: { fontFamily: FUENTE.negra, fontSize: 19, color: COLOR.texto, letterSpacing: -0.5 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: COLOR.tenue, borderWidth: 1, borderColor: COLOR.borde },
  iconoOpcion: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLOR.lima, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 20, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  chipActivo: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  textoChip: { fontFamily: FUENTE.fuerte, fontSize: 13, color: COLOR.bosque },
  mercado: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingVertical: 14, borderRadius: 24, backgroundColor: COLOR.bosque, overflow: 'hidden' },
  tituloMercado: { fontFamily: FUENTE.negra, fontSize: 18, color: COLOR.lima, letterSpacing: -0.4 },
  textoMercado: { fontFamily: FUENTE.semi, fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  imagenMercado: { width: 104, height: 92, marginRight: -6 },
});
