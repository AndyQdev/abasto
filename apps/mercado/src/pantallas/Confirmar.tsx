import { useEffect, useState } from 'react';
import { bs, cantidadConUnidad, porMayorista, totalDe, type ItemDeCarrito } from '../carrito';
import { nombreCorto } from '../catalogo';
import { Icono } from '../Icono';
import { bandeja, graphql } from '../servicios';

export type MetodoPago = 'QR' | 'CREDITO';

interface Props {
  carrito: ItemDeCarrito[];
  enLinea: boolean;
  tiendaId: string;
  alVolver: () => void;
  alTerminar: () => void;
}

type Credito = Record<string, { disponible: { centavos: number; texto: string } } | null>;

/**
 * Finalizar no llama al servidor: deja un pedido por mayorista en la bandeja offline, cada uno con su clave.
 * Con señal la bandeja lo manda enseguida; sin señal, cuando vuelva.
 */
export function Confirmar({ carrito, enLinea, tiendaId, alVolver, alTerminar }: Props) {
  const grupos = porMayorista(carrito);
  const total = grupos.reduce((s, g) => s + g.totalEstimadoCentavos, 0);
  const [metodo, setMetodo] = useState<MetodoPago>('QR');
  const [credito, setCredito] = useState<Credito>({});
  const [enviando, setEnviando] = useState(false);

  // El crédito disponible con cada mayorista (Cobros), para avisar antes si no alcanza
  const mayoristas = grupos.map((g) => g.mayoristaId).join(',');
  useEffect(() => {
    if (!enLinea || !mayoristas) return;
    const ids = mayoristas.split(',');
    const parametros = ids.map((_, i) => `$m${i}: ID!`).join(', ');
    const campos = ids.map((_, i) => `c${i}: lineaDeCredito(tiendaId: $t, mayoristaId: $m${i}) { disponible { centavos texto } }`);
    const variables = Object.fromEntries([['t', tiendaId], ...ids.map((id, i) => [`m${i}`, id])]);
    graphql<Record<string, Credito[string]>>(`query Credito($t: ID!, ${parametros}) { ${campos.join(' ')} }`, variables)
      .then((r) => setCredito(Object.fromEntries(ids.map((id, i) => [id, r[`c${i}`]]))))
      .catch(() => setCredito({}));
  }, [enLinea, tiendaId, mayoristas]);

  const sinCupo = grupos.filter((g) => {
    const c = credito[g.mayoristaId];
    return !c || c.disponible.centavos < g.totalEstimadoCentavos;
  });

  async function finalizar() {
    setEnviando(true);
    for (const g of grupos) {
      await bandeja.agregar('pedido.crear', {
        mayoristaId: g.mayoristaId,
        metodoPago: metodo,
        lineas: g.items.map((i) => ({ productoId: i.productoId, presentacion: i.presentacion, cantidad: i.cantidad })),
      });
    }
    if (enLinea) void bandeja.sincronizar();
    alTerminar();
  }

  return (
    <div className="pantalla">
      <div className="fila-chica">
        <button type="button" className="ico-plano" aria-label="Volver" onClick={alVolver}>
          <Icono nombre="volver" />
        </button>
        <h1 className="tit t2">Finalizar pedido</h1>
      </div>

      {!enLinea && (
        <div className="aviso-ambar">No hay señal. Guardamos tu pedido y se envía solo cuando vuelva. El pago por QR se hace después.</div>
      )}

      <section className="tarj resumen">
        <h2 className="tit t3">Resumen del pedido</h2>
        {grupos.map((g) => (
          <div key={g.mayoristaId} className="resumen-grupo">
            <span className="entre">
              <strong>{g.mayoristaNombre}</strong>
              <strong className="num">{bs(g.totalEstimadoCentavos)}</strong>
            </span>
            {g.items.map((i) => (
              <span key={`${i.productoId}-${i.presentacion}`} className="entre gris">
                <span>
                  {i.nombre} · {cantidadConUnidad(i)}
                </span>
                <span className="num">{bs(totalDe(i))}</span>
              </span>
            ))}
          </div>
        ))}
        <div className="entre">
          <strong>Total estimado</strong>
          <strong className="tit num total-grande">{bs(total)}</strong>
        </div>
      </section>

      <section className="seccion">
        <h2 className="tit t3">Método de pago</h2>
        <button type="button" className="radio" aria-pressed={metodo === 'QR'} onClick={() => setMetodo('QR')}>
          <span className="punto" aria-hidden="true" />
          <span className="crece">
            <strong>Pago por QR</strong>
            <span className="gris">Pagas desde tu banco o billetera cuando el mayorista reserva tu pedido</span>
          </span>
        </button>
        <button type="button" className="radio" aria-pressed={metodo === 'CREDITO'} onClick={() => setMetodo('CREDITO')}>
          <span className="punto" aria-hidden="true" />
          <span className="crece">
            <strong>Crédito con el mayorista</strong>
            <span className="gris">Solo con los mayoristas que te dieron crédito</span>
          </span>
        </button>
        {metodo === 'CREDITO' && (
          <div className={sinCupo.length ? 'aviso-ambar' : 'aviso-verde'}>
            <strong>Tu crédito</strong>
            {grupos.map((g) => {
              const c = credito[g.mayoristaId];
              return (
                <span key={g.mayoristaId}>
                  {nombreCorto(g.mayoristaNombre)}: {c ? `${c.disponible.texto} disponible` : 'no tienes crédito con este mayorista'}
                </span>
              );
            })}
            {sinCupo.length > 0 && <span>Si no alcanza, el mayorista no puede aceptar el pedido a crédito. Mejor paga por QR.</span>}
          </div>
        )}
      </section>

      <button type="button" className="btn" disabled={enviando} onClick={() => void finalizar()}>
        {enLinea ? `Hacer ${grupos.length === 1 ? 'el pedido' : `los ${grupos.length} pedidos`}` : 'Guardar pedido · se enviará cuando vuelva la señal'}
      </button>
    </div>
  );
}
