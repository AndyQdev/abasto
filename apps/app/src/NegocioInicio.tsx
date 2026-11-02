import {
  SUBTIPOS,
  SUBTIPOS_DE_PRODUCTOR,
  TIPOS,
  TIPOS_DE_NEGOCIO,
  leerNegocio,
  type NegocioElegido,
  type PedidoDeLaSemana,
  type SubtipoProductor,
  type TipoDeNegocio,
} from '@abasto/comercio';
import { Image } from 'expo-image';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Flotar, Tocable } from './animacion';
import { Boton, Icono, Texto, type NombreDeIcono } from './componentes';
import { guardado } from './guardado';
import { ILUSTRACION } from './ilustraciones';
import { COLOR, FUENTE, SOMBRA } from './tema';

/**
 * El tipo de cliente (01/11, plan en `docs/plan-mi-negocio.md`): hogar, tienda o productor (salteñería, panadería o
 * pensión). Es obligatorio al registrarse (`pantallas/Negocio.tsx`) y se cambia en Cuenta. El Inicio lo usa para
 * mostrar primero lo suyo. Se guarda en el teléfono; lo de antes («masas», «cocina») se traduce solo.
 */
export const ICONO_DE_NEGOCIO: Record<TipoDeNegocio, NombreDeIcono> = { hogar: 'home', tienda: 'storefront', productor: 'restaurant' };
export const ICONO_DE_SUBTIPO: Record<SubtipoProductor, NombreDeIcono> = { salteneria: 'flame', panaderia: 'pizza', pension: 'restaurant' };

/** La ilustración 3D de cada tipo, para el registro */
export const IMAGEN_DE_NEGOCIO: Record<TipoDeNegocio, number> = {
  hogar: ILUSTRACION.negocioHogar,
  tienda: ILUSTRACION.negocioTienda,
  productor: ILUSTRACION.negocioProductor,
};

interface EstadoDeNegocio {
  negocio: NegocioElegido | null;
  /** false mientras se lee del teléfono: evita mostrar la pregunta un instante a quien ya eligió */
  leido: boolean;
  elegir: (n: NegocioElegido) => void;
}

const Contexto = createContext<EstadoDeNegocio | null>(null);

export function ProveedorDeNegocio({ children }: { children: ReactNode }) {
  const [negocio, setNegocio] = useState<NegocioElegido | null>(null);
  const [leido, setLeido] = useState(false);
  useEffect(() => {
    void guardado.leer<unknown>('negocio').then((v) => {
      setNegocio(leerNegocio(v));
      setLeido(true);
    });
  }, []);
  const elegir = (n: NegocioElegido) => {
    setNegocio(n);
    void guardado.escribir('negocio', n);
  };
  return <Contexto.Provider value={{ negocio, leido, elegir }}>{children}</Contexto.Provider>;
}

export function useNegocio() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useNegocio va dentro de ProveedorDeNegocio');
  return c;
}

interface Opcion<T extends string> {
  valor: T;
  texto: string;
  icono: NombreDeIcono;
}

/** Una fila de chips de los que se elige uno */
export function Chips<T extends string>({ opciones, elegido, alElegir }: { opciones: Opcion<T>[]; elegido: T | null | undefined; alElegir: (v: T) => void }) {
  return (
    <View style={e.chips} accessibilityRole="radiogroup">
      {opciones.map((o) => {
        const activo = o.valor === elegido;
        return (
          <Tocable
            key={o.valor}
            onPress={() => alElegir(o.valor)}
            exterior={{ flex: 1 }}
            style={[e.chip, activo && e.chipActivo]}
            accessibilityRole="radio"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={o.texto}
          >
            <Icono nombre={o.icono} tamano={16} color={activo ? COLOR.lima : COLOR.bosque} />
            <Texto style={[e.textoChip, activo && { color: COLOR.lima }]} lineas={1}>
              {o.texto}
            </Texto>
          </Tocable>
        );
      })}
    </View>
  );
}

export const OPCIONES_DE_TIPO: Opcion<TipoDeNegocio>[] = TIPOS_DE_NEGOCIO.map((t) => ({ valor: t, texto: TIPOS[t].corto, icono: ICONO_DE_NEGOCIO[t] }));
export const OPCIONES_DE_SUBTIPO: Opcion<SubtipoProductor>[] = SUBTIPOS_DE_PRODUCTOR.map((t) => ({ valor: t, texto: SUBTIPOS[t].nombre, icono: ICONO_DE_SUBTIPO[t] }));

/** En Cuenta: el tipo y, si es productor, qué hace */
export function CambiarNegocio() {
  const { negocio, elegir } = useNegocio();
  return (
    <View style={{ gap: 8 }}>
      <Chips
        opciones={OPCIONES_DE_TIPO}
        elegido={negocio?.tipo}
        alElegir={(tipo) => elegir(tipo === 'productor' ? { tipo, subtipo: negocio?.subtipo ?? 'salteneria' } : { tipo })}
      />
      {negocio?.tipo === 'productor' && <Chips opciones={OPCIONES_DE_SUBTIPO} elegido={negocio.subtipo} alElegir={(subtipo) => elegir({ tipo: 'productor', subtipo })} />}
    </View>
  );
}

/**
 * La promesa de Abasto: la imagen manda (la moto llena del mercado, que sobresale) y el texto es corto.
 */
export function SinIrAlMercado({ horas }: { horas: number }) {
  const cuando = horas <= 24 ? 'Llega mañana' : `Llega en ${horas} h`;
  return (
    <View style={e.mercado} accessibilityRole="summary" accessibilityLabel={`No vuelvas a ir al mercado. Pides hoy, ${cuando.toLowerCase()}.`}>
      <View style={e.textosMercado}>
        <Texto style={e.tituloMercado}>No vuelvas a ir al mercado</Texto>
        <View style={e.pildora}>
          <Icono nombre="time" tamano={14} color={COLOR.bosque} />
          <Texto style={e.textoPildora} lineas={1}>
            {cuando}
          </Texto>
        </View>
      </View>
      <View style={e.lugarImagen} pointerEvents="none">
        <Flotar alto={5}>
          <Image source={ILUSTRACION.bannerMercado} style={e.imagenMercado} contentFit="contain" accessibilityIgnoresInvertColors />
        </Flotar>
      </View>
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
      {pedido.faltan.length > 0 && <Texto v="chico">Ya no vendemos: {pedido.faltan.join(', ')}.</Texto>}
      <Boton texto="Pedir lo mismo" icono="repeat" alTocar={alRepetir} />
    </View>
  );
}

const e = StyleSheet.create({
  carta: { gap: 12, padding: 16, borderRadius: 24, backgroundColor: COLOR.superficie, ...SOMBRA },
  pregunta: { fontFamily: FUENTE.negra, fontSize: 19, color: COLOR.texto, letterSpacing: -0.5 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 21, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.borde },
  chipActivo: { backgroundColor: COLOR.bosque, borderColor: COLOR.bosque },
  textoChip: { fontFamily: FUENTE.fuerte, fontSize: 13, color: COLOR.bosque },
  // La moto sobresale por arriba (dentro del espacio entre secciones) y por la derecha
  mercado: { height: 136, borderRadius: 26, backgroundColor: COLOR.bosque, justifyContent: 'center' },
  textosMercado: { width: '54%', paddingLeft: 18, gap: 10 },
  tituloMercado: { fontFamily: FUENTE.negra, fontSize: 21, lineHeight: 24, color: COLOR.lima, letterSpacing: -0.6 },
  pildora: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: COLOR.lima },
  textoPildora: { fontFamily: FUENTE.fuerte, fontSize: 12.5, color: COLOR.bosque },
  lugarImagen: { position: 'absolute', right: -8, bottom: 0 },
  imagenMercado: { width: 190, height: 160 },
});
