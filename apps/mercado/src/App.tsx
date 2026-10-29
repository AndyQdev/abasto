import { useEffect, useRef, useState } from 'react';
import type { Usuario } from '@abasto/sesion';
import { escalaPorDefecto, itemDeCarrito, type Producto as P } from './catalogo';
import { agregar, cantidadDe, type ItemDeCarrito } from './carrito';
import type { Navegar } from './componentes';
import { Icono } from './Icono';
import { Buscar, type EstadoBusqueda } from './pantallas/Buscar';
import { Carrito } from './pantallas/Carrito';
import { Cuenta } from './pantallas/Cuenta';
import { Inicio } from './pantallas/Inicio';
import { Mayorista } from './pantallas/Mayorista';
import { Pedidos } from './pantallas/Pedidos';
import { Producto } from './pantallas/Producto';
import { bandeja, guardado } from './servicios';
import { useCatalogo } from './useCatalogo';

type Pestana = 'inicio' | 'buscar' | 'carrito' | 'pedidos' | 'cuenta';
type Vista = { tipo: 'producto'; id: string } | { tipo: 'mayorista'; id: string };

function useEnLinea() {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener('online', si);
    window.addEventListener('offline', no);
    return () => {
      window.removeEventListener('online', si);
      window.removeEventListener('offline', no);
    };
  }, []);
  return enLinea;
}

/** Las fichas de producto y de mayorista se apilan sobre la pestaña y el botón Atrás del teléfono las cierra. */
function useVista() {
  const [vista, setVista] = useState<Vista | null>(null);
  useEffect(() => {
    const alVolver = (e: PopStateEvent) => setVista((e.state as { vista?: Vista } | null)?.vista ?? null);
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);
  return {
    vista,
    abrir(v: Vista) {
      history.pushState({ vista: v }, '');
      setVista(v);
      window.scrollTo(0, 0);
    },
    volver: () => history.back(),
    cerrar: () => setVista(null),
  };
}

export function App({ usuario }: { usuario: Usuario }) {
  const enLinea = useEnLinea();
  const catalogo = useCatalogo(enLinea);
  const { vista, abrir, volver, cerrar } = useVista();
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [busqueda, setBusqueda] = useState<EstadoBusqueda>({ texto: '', rubro: null, modo: 'productos' });
  const [carrito, setCarrito] = useState<ItemDeCarrito[]>(() => guardado.leer<ItemDeCarrito[]>('carrito') ?? []);
  const [aviso, setAviso] = useState<string | null>(null);
  const reloj = useRef<number | undefined>(undefined);

  useEffect(() => guardado.escribir('carrito', carrito), [carrito]);

  // Al volver la red y al abrir la app se manda la bandeja. Safari en iPhone no tiene Background Sync.
  useEffect(() => {
    if (enLinea) void bandeja.sincronizar();
  }, [enLinea]);

  function avisar(texto: string) {
    setAviso(texto);
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => setAviso(null), 2500);
  }

  function alAgregar(item: ItemDeCarrito) {
    setCarrito((c) => agregar(c, item));
    avisar(`Agregaste ${cantidadDe(item.presentacion, item.cantidad)} de ${item.nombre}`);
  }

  function irA(p: Pestana) {
    cerrar();
    setPestana(p);
    window.scrollTo(0, 0);
  }

  const ir: Navegar = {
    producto: (id) => abrir({ tipo: 'producto', id }),
    mayorista: (id) => abrir({ tipo: 'mayorista', id }),
    buscar: (filtro) => {
      setBusqueda((b) => ({ texto: '', rubro: filtro?.rubro ?? null, modo: filtro?.modo ?? b.modo }));
      irA('buscar');
    },
    agregar: (p: P) => {
      const escala = escalaPorDefecto(p);
      if (escala) alAgregar(itemDeCarrito(p, escala));
    },
  };

  const producto = vista?.tipo === 'producto' ? catalogo.productos.find((p) => p.id === vista.id) : undefined;
  const mayorista = vista?.tipo === 'mayorista' ? catalogo.mayoristas.find((m) => m.id === vista.id) : undefined;
  const nCarrito = carrito.length;

  return (
    <div className="mercado">
      {!enLinea && (
        <div className="aviso-sin-senal" role="status">
          <Icono nombre="sinSenal" tamano={16} />
          <span>
            <strong>Sin conexión</strong> · usas tus datos guardados
          </span>
        </div>
      )}

      {!vista && (
        <header className="barra">
          <span className="marca">
            <strong>Abasto</strong>
            <span className="gris">{usuario.orgNombre} · Santa Cruz</span>
          </span>
          <button type="button" className="ico" aria-label={`Carrito, ${nCarrito} productos`} onClick={() => irA('carrito')}>
            <Icono nombre="carrito" />
            {nCarrito > 0 && (
              <span className="insignia-num" aria-hidden="true">
                {nCarrito}
              </span>
            )}
          </button>
        </header>
      )}

      <main>
        {vista && producto && (
          <Producto
            key={producto.id}
            producto={producto}
            enLinea={enLinea}
            ir={ir}
            alVolver={volver}
            alAgregar={alAgregar}
            alPedirSerCliente={catalogo.pedirSerCliente}
          />
        )}
        {vista && mayorista && (
          <Mayorista
            key={mayorista.id}
            mayorista={mayorista}
            productos={catalogo.productos}
            enLinea={enLinea}
            ir={ir}
            alVolver={volver}
            alPedirSerCliente={catalogo.pedirSerCliente}
          />
        )}
        {vista && !producto && !mayorista && (
          <section className="pantalla">
            <p className="vacio">{catalogo.cargando ? 'Cargando…' : 'No encontramos lo que buscabas. Puede que ya no esté publicado.'}</p>
            <button type="button" className="btn2" onClick={volver}>
              Volver
            </button>
          </section>
        )}

        {!vista && pestana === 'inicio' && <Inicio catalogo={catalogo} ir={ir} />}
        {!vista && pestana === 'buscar' && (
          <Buscar catalogo={catalogo} enLinea={enLinea} estado={busqueda} alCambiar={setBusqueda} ir={ir} />
        )}
        {!vista && pestana === 'carrito' && (
          <Carrito carrito={carrito} enLinea={enLinea} alCambiar={setCarrito} alTerminar={() => irA('pedidos')} />
        )}
        {!vista && pestana === 'pedidos' && <Pedidos enLinea={enLinea} />}
        {!vista && pestana === 'cuenta' && <Cuenta usuario={usuario} />}
      </main>

      {aviso && (
        <div className="aviso-flotante" role="status">
          {aviso}
        </div>
      )}

      <nav className="inferior" aria-label="Secciones">
        {(
          [
            ['inicio', 'Inicio'],
            ['buscar', 'Buscar'],
            ['carrito', `Carrito${nCarrito ? ` (${nCarrito})` : ''}`],
            ['pedidos', 'Pedidos'],
            ['cuenta', 'Cuenta'],
          ] as [Pestana, string][]
        ).map(([id, texto]) => (
          <button key={id} className={!vista && pestana === id ? 'activo' : undefined} aria-current={!vista && pestana === id ? 'page' : undefined} onClick={() => irA(id)}>
            {texto}
          </button>
        ))}
      </nav>
    </div>
  );
}
