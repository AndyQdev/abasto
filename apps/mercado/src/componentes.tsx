import { useState } from 'react';
import { escalaPorDefecto, iniciales, tinte, type Mayorista, type Producto } from './catalogo';
import { Icono } from './Icono';

/** Lo que cada pantalla puede pedirle a la app */
export interface Navegar {
  producto: (id: string) => void;
  mayorista: (id: string) => void;
  buscar: (filtro?: { rubro?: string | null; modo?: 'productos' | 'mayoristas' }) => void;
  agregar: (p: Producto) => void;
}

export function Foto({ producto, clase = '', alAbrir }: { producto: Producto; clase?: string; alAbrir?: () => void }) {
  const contenido = <Icono nombre="caja" tamano={28} />;
  const clases = `foto ${tinte(producto.rubro)} ${clase}`;
  return alAbrir ? (
    <button type="button" className={clases} aria-label={`Ver ${producto.nombre}`} onClick={alAbrir}>
      {contenido}
    </button>
  ) : (
    <span className={clases} aria-hidden="true">
      {contenido}
    </span>
  );
}

export function Iniciales({ nombre, clase = '' }: { nombre: string; clase?: string }) {
  return (
    <span className={`iniciales ${clase}`} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}

/** Botón verde «+» que agrega la escala por defecto (una docena) */
export function BotonAgregar({ producto, alAgregar }: { producto: Producto; alAgregar: (p: Producto) => void }) {
  const escala = escalaPorDefecto(producto);
  if (!escala || producto.estado === 'SIN_STOCK') return null;
  return (
    <button
      type="button"
      className="boton-mas"
      aria-label={`Agregar una ${escala.presentacion.toLowerCase()} de ${producto.nombre}`}
      onClick={() => alAgregar(producto)}
    >
      <Icono nombre="mas" />
    </button>
  );
}

export function InsigniaRelacion({ relacion }: { relacion: Mayorista['relacion'] }) {
  if (relacion === 'APROBADA') return <span className="ins ins-verde">Eres cliente</span>;
  if (relacion === 'SOLICITADA') return <span className="ins ins-ambar">Solicitud enviada</span>;
  if (relacion === 'RECHAZADA') return <span className="ins ins-gris">No aprobada</span>;
  return null;
}

/**
 * Lo que ve una tienda cuando el mayorista todavía no la aprobó.
 * El precio lo oculta Catálogo; aquí solo se ofrece pedir ser cliente.
 */
export function PedirSerCliente({
  mayorista,
  enLinea,
  alPedir,
  titulo,
  detalle,
}: {
  mayorista: Mayorista;
  enLinea: boolean;
  alPedir: (id: string) => Promise<string | null>;
  titulo: string;
  detalle: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedir() {
    setEnviando(true);
    setError(await alPedir(mayorista.id));
    setEnviando(false);
  }

  // Catálogo deja volver a pedir después de un rechazo (RelacionComercial::volverASolicitar)
  const puedePedir = mayorista.relacion === 'NINGUNA' || mayorista.relacion === 'RECHAZADA';
  return (
    <section className="tarj bloqueo">
      <strong className="tit t3">{titulo}</strong>
      <span className="texto-2">{detalle}</span>
      {mayorista.relacion === 'RECHAZADA' && <span className="ins ins-gris">El mayorista no aprobó tu solicitud anterior</span>}
      {puedePedir && (
        <button type="button" className="btn" disabled={enviando || !enLinea} onClick={() => void pedir()}>
          {enviando ? 'Enviando…' : mayorista.relacion === 'RECHAZADA' ? 'Volver a pedir' : 'Pedir ser cliente'}
        </button>
      )}
      {puedePedir && !enLinea && <span className="gris">Necesitas conexión para pedir ser cliente.</span>}
      {mayorista.relacion === 'SOLICITADA' && <span className="ins ins-ambar">Solicitud enviada · por confirmar</span>}
      {error && <p className="falla">{error}</p>}
    </section>
  );
}

export function SinPrecio({ texto = 'Pide ser cliente para ver precios' }: { texto?: string }) {
  return (
    <span className="sin-precio">
      <Icono nombre="candado" tamano={14} />
      {texto}
    </span>
  );
}
