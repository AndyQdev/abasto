import {
  CATEGORIAS_DE_GASTO,
  CATEGORIAS_DE_INGRESO,
  ahorroFrenteAlSuper,
  anotacion,
  bs,
  cuentasDelMes,
  mesDe,
  nombreDelMes,
  otroMes,
  type DatosDeNegocio,
  type PedidoComprado,
  type Producto,
} from '@abasto/comercio';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tocable } from '../animacion';
import { Boton, Icono, Texto } from '../componentes';
import { ahora, nuevoId, useInventario } from '../inventario';
import { COLOR, FUENTE } from '../tema';
import { HojaDeAnotacion } from './ElMes';
import { CabezaDeSeccion, Cifra, fecha, ui } from './ui';

/**
 * Las cuentas de la casa (fase 6): «te quedan Bs X» este mes. Lo comprado en Abasto se anota solo como gasto; los
 * demás ingresos y gastos se anotan con un toque. Abajo, cuánto se ahorró frente al súper con lo que se compró.
 */
export function Cuentas({ datos, pedidos, productos }: { datos: DatosDeNegocio; pedidos: PedidoComprado[]; productos: Producto[] }) {
  const { aplicar } = useInventario();
  const [mes, setMes] = useState(mesDe(ahora()));
  const [anotando, setAnotando] = useState<'INGRESO' | 'GASTO' | null>(null);
  const c = cuentasDelMes(datos.anotaciones, mes);
  const ahorro = ahorroFrenteAlSuper(pedidos, productos, mes);
  const esEsteMes = mes === mesDe(ahora());
  const mayor = Math.max(1, ...c.porCategoria.map((x) => x.centavos));

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

      <Cifra nombre={c.quedanCentavos >= 0 ? 'Te quedan este mes' : 'Gastaste de más'} valor={bs(Math.abs(c.quedanCentavos))} tono="fuerte" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Cifra nombre="Entró" valor={bs(c.ingresosCentavos)} />
        <Cifra nombre="Gastaste" valor={bs(c.gastosCentavos)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Boton texto="+ Ingreso" alTocar={() => setAnotando('INGRESO')} />
        </View>
        <View style={{ flex: 1 }}>
          <Boton tipo="oscuro" texto="+ Gasto" alTocar={() => setAnotando('GASTO')} />
        </View>
      </View>

      {ahorro.lineasComparadas > 0 && ahorro.ahorroCentavos > 0 && (
        <View style={e.ahorro}>
          <Icono nombre="sparkles" tamano={22} color={COLOR.bosque} />
          <View style={{ flex: 1 }}>
            <Texto v="fuerte">Ahorraste {bs(ahorro.ahorroCentavos)} frente al súper</Texto>
            <Texto v="chico">Con lo que compraste en Abasto este mes, comparado con el precio del súper.</Texto>
          </View>
        </View>
      )}

      {c.porCategoria.length > 0 && (
        <View style={ui.tarjeta}>
          <CabezaDeSeccion icono="pie-chart" titulo="En qué se fue" />
          {c.porCategoria.map((x) => (
            <View key={x.categoria} style={{ gap: 4 }}>
              <View style={e.renglon}>
                <Texto style={{ flex: 1 }}>{x.categoria}</Texto>
                <Texto style={e.monto}>{bs(x.centavos)}</Texto>
              </View>
              <View style={e.barra}>
                <View style={[e.relleno, { width: `${Math.max(4, Math.round((x.centavos / mayor) * 100))}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {c.anotaciones.length > 0 ? (
        <View style={ui.tarjeta}>
          <CabezaDeSeccion icono="list" titulo="Anotado" />
          {c.anotaciones.map((a) => (
            <View key={a.id} style={e.renglon}>
              <Icono nombre={a.tipo === 'INGRESO' ? 'arrow-down-circle' : a.origen === 'ABASTO' ? 'cart' : 'arrow-up-circle'} tamano={18} color={a.tipo === 'INGRESO' ? COLOR.bosque : COLOR.ambarTexto} />
              <Texto style={{ flex: 1 }} lineas={1}>
                {a.nota ? `${a.categoria} · ${a.nota}` : a.categoria}
              </Texto>
              <Texto v="chico">{fecha(a.fecha)}</Texto>
              <Texto style={[e.monto, { color: a.tipo === 'INGRESO' ? COLOR.bosque : COLOR.ambarTexto }]}>
                {a.tipo === 'INGRESO' ? '+' : '−'} {bs(a.montoCentavos)}
              </Texto>
            </View>
          ))}
        </View>
      ) : (
        <View style={ui.vacio}>
          <Icono nombre="wallet-outline" tamano={20} color={COLOR.texto3} />
          <Texto v="gris" style={{ flex: 1 }}>
            Anota lo que entra y lo que gastas. Lo que compras en Abasto se anota solo.
          </Texto>
        </View>
      )}

      <HojaDeAnotacion
        visible={anotando !== null}
        tipo={anotando ?? 'GASTO'}
        categorias={anotando === 'INGRESO' ? CATEGORIAS_DE_INGRESO : CATEGORIAS_DE_GASTO}
        alCerrar={() => setAnotando(null)}
        alGuardar={async (monto, categoria, nota) => {
          await aplicar({ anotaciones: [anotacion(anotando ?? 'GASTO', monto, categoria, nota, ahora(), nuevoId())] });
          setAnotando(null);
        }}
      />
    </View>
  );
}

const e = StyleSheet.create({
  mes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flecha: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLOR.limaMedia, alignItems: 'center', justifyContent: 'center' },
  nombreMes: { fontFamily: FUENTE.negra, fontSize: 19, color: COLOR.texto, textTransform: 'capitalize' },
  ahorro: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: COLOR.limaMedia },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  monto: { minWidth: 90, textAlign: 'right', fontFamily: FUENTE.fuerte, color: COLOR.texto },
  barra: { height: 8, borderRadius: 4, backgroundColor: COLOR.tenue, overflow: 'hidden' },
  relleno: { height: 8, borderRadius: 4, backgroundColor: COLOR.lima },
});
