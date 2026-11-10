import { RECORTE, SIMBOLO, TINTAS, type Tinta } from '@abasto/marca';
import { useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { COLOR, FUENTE } from './tema';

/**
 * La marca de Abasto (10/11): la «A» lima con el paquete ámbar de travesaño. La geometría sale de
 * `packages/ui/marca.ts`, la misma de los íconos y de las webs.
 */
export function Simbolo({ tamano = 32, tinta = TINTAS.sobreOscuro }: { tamano?: number; tinta?: Tinta }) {
  const id = 'recorte' + useId().replace(/:/g, '');
  const s = SIMBOLO;
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id={id}>
          <Path d={RECORTE} clipRule="evenodd" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Path d={s.patas} fill="none" stroke={tinta.patas} strokeWidth={s.grosor} strokeLinecap="round" strokeLinejoin="round" />
      </G>
      <Rect x={s.paquete.x} y={s.paquete.y} width={s.paquete.ancho} height={s.paquete.alto} rx={s.paquete.radio} fill={tinta.paquete} />
      {tinta.cinta && <Rect x={s.cinta.x} y={s.cinta.y} width={s.cinta.ancho} height={s.cinta.alto} fill={tinta.cinta} />}
    </Svg>
  );
}

/** El logo completo: símbolo + «abasto». `claro` para fondos oscuros (la palabra en blanco). */
export function Logo({ tamano = 30, claro }: { tamano?: number; claro?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tamano * 0.14 }} accessible accessibilityRole="image" accessibilityLabel="Abasto">
      <Simbolo tamano={tamano} tinta={claro ? TINTAS.sobreOscuro : TINTAS.sobreClaro} />
      <Text
        style={{
          fontFamily: FUENTE.negra,
          fontSize: tamano * 0.8,
          letterSpacing: -0.035 * tamano * 0.8,
          lineHeight: tamano,
          marginTop: tamano * 0.02,
          color: claro ? '#FFFFFF' : COLOR.bosque,
          includeFontPadding: false,
        }}
      >
        abasto
      </Text>
    </View>
  );
}
