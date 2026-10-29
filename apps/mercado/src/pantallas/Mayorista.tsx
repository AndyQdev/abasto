import { escalaPorDefecto, filtrar, nombreCorto, type Mayorista as M, type Producto } from '../catalogo';
import { bs } from '../carrito';
import { BotonAgregar, Foto, Iniciales, PedirSerCliente, type Navegar } from '../componentes';
import { Icono } from '../Icono';

interface Props {
  mayorista: M;
  productos: Producto[];
  enLinea: boolean;
  ir: Navegar;
  alVolver: () => void;
  alPedirSerCliente: (mayoristaId: string) => Promise<string | null>;
}

/** Perfil del mayorista con su catálogo. Sin relación aprobada, el catálogo se ve sin precios. */
export function Mayorista({ mayorista: m, productos, enLinea, ir, alVolver, alPedirSerCliente }: Props) {
  const catalogo = filtrar(productos, { mayoristaId: m.id });
  const aprobado = m.relacion === 'APROBADA';
  // Abasto le vende a todas las tiendas registradas: no hace falta pedir ser cliente
  const puedeComprar = aprobado || m.deLaCasa;

  return (
    <div className="detalle">
      <div className="detalle-foto puesto">
        <span className="gris">Foto del puesto</span>
        <button type="button" className="ico flotante izquierda" aria-label="Volver" onClick={alVolver}>
          <Icono nombre="volver" />
        </button>
      </div>

      <div className="detalle-cuerpo perfil">
        <div className="perfil-marca">
          <Iniciales nombre={m.nombre} clase="perfil" />
          {m.verificado && (
            <span className="ins ins-verde">
              <Icono nombre="verificado" tamano={14} />
              Mayorista verificado
            </span>
          )}
        </div>
        <div className="detalle-cabeza">
          <h1 className="tit t1">{m.nombre}</h1>
          <span className="texto-2">
            <Icono nombre="ubicacion" tamano={14} /> {m.ciudad}
          </span>
        </div>

        {puedeComprar ? (
          <span className="ins ins-verde">{m.deLaCasa && !aprobado ? 'Le vende a todas las tiendas · pide hoy y te lo llevamos' : 'Eres cliente · ves los precios de tu lista'}</span>
        ) : (
          <PedirSerCliente
            mayorista={m}
            enLinea={enLinea}
            alPedir={alPedirSerCliente}
            titulo={`Todavía no eres cliente de ${nombreCorto(m.nombre)}`}
            detalle="Cuando te apruebe, verás sus precios y podrás comprar."
          />
        )}

        <h2 className="tit t2">Catálogo · {catalogo.length} productos</h2>
        <div className="lista">
          {catalogo.map((p) => {
            const escala = escalaPorDefecto(p);
            return (
              <div key={p.id} className="tarj fila catalogo-fila">
                <Foto producto={p} clase="foto-60" alAbrir={() => ir.producto(p.id)} />
                <button type="button" className="crece nombre" onClick={() => ir.producto(p.id)}>
                  <strong>{p.nombre}</strong>
                  <span className="gris">{p.rubro}</span>
                  {escala?.precioUnitario ? (
                    <span className="chico">
                      <span className="precio">{bs(escala.precioUnitario.centavos * escala.cantidad)}</span>{' '}
                      <span className="gris">
                        la {escala.presentacion.toLowerCase()} · {escala.precioUnitario.texto} c/u
                      </span>
                    </span>
                  ) : (
                    <span className="gris">Precio para clientes</span>
                  )}
                </button>
                <BotonAgregar producto={p} alAgregar={ir.agregar} />
              </div>
            );
          })}
          {!catalogo.length && <p className="vacio">Este mayorista todavía no publicó productos.</p>}
        </div>
      </div>
    </div>
  );
}
