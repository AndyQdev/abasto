import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ALTO_PANZA, formaDelHalo } from './forma-del-halo';
import { APPS, type Usuario } from '@abasto/sesion';
import type { Alerta } from './alertas';
import { Icono, Simbolo } from './iconos';
import { ACCESOS_DEL_DOCK, DE_MAS, PRINCIPALES, destinoDeBusqueda, type Modulo } from './navegacion';

/** Cierra un menú desplegable al tocar afuera o con Escape. */
function useCerrarAfuera(abierto: boolean, cerrar: () => void) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (caja.current && !e.composedPath().includes(caja.current)) cerrar();
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar]);
  return caja;
}

function Desplegable({
  boton,
  children,
  clase,
}: {
  boton: (abierto: boolean, alternar: () => void) => ReactNode;
  children: (cerrar: () => void) => ReactNode;
  clase?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);
  const caja = useCerrarAfuera(abierto, cerrar);
  return (
    <div className={`desplegable ${clase ?? ''}`} ref={caja}>
      {boton(abierto, () => setAbierto((v) => !v))}
      {abierto && children(cerrar)}
    </div>
  );
}

/** La lista de lo que espera una decisión: la usan la campana y «Alertas» del dock. */
function ListaDeAlertas({ alertas, navegar, cerrar }: { alertas: Alerta[]; navegar: (r: string) => void; cerrar: () => void }) {
  return (
    <div className="flotante alertas" role="dialog" aria-label="Alertas">
      <p className="flotante-titulo">{alertas.length ? `Te esperan ${alertas.length}` : 'Todo al día'}</p>
      {alertas.length === 0 && <p className="flotante-vacio">No hay pedidos por confirmar ni tiendas esperando.</p>}
      <ul>
        {alertas.slice(0, 8).map((a) => (
          <li key={a.id}>
            <button
              className={`alerta ${a.tono}`}
              onClick={() => {
                navegar(a.ruta);
                cerrar();
              }}
            >
              <strong>{a.titulo}</strong>
              <span>{a.detalle}</span>
            </button>
          </li>
        ))}
      </ul>
      {alertas.length > 8 && (
        <button
          className="flotante-pie"
          onClick={() => {
            navegar('pedidos');
            cerrar();
          }}
        >
          Ver los {alertas.length} en Pedidos
        </button>
      )}
    </div>
  );
}

const AYUDA: [string, string][] = [
  ['Pedidos', 'Confirma lo que entra, prepáralo y márcalo entregado. Un toque en el pedido muestra todo lo que lleva.'],
  ['Compras', 'Lo que tienes que salir a comprar hoy, por mercado. Marca cada cosa al comprarla.'],
  ['Productos', 'Tus precios por volumen, a quién se muestra cada producto y si está activo.'],
  ['Clientes', 'Las tiendas que quieren comprarte: apruébalas con una lista de precios.'],
];

interface PropsDelMarco {
  usuario: Usuario;
  modulo: Modulo;
  alertas: Alerta[];
  navegar: (ruta: string) => void;
  salir: () => void;
  children: ReactNode;
}

/**
 * El marco «Halo» del Panel (versión 7): header verde bosque con la curva que abraza al menú blanco flotante,
 * y el dock de accesos rápidos a la derecha. Es igual en todas las secciones: solo se mueve la selección lima.
 */
export function Marco({ usuario, modulo, alertas, navegar, salir, children }: PropsDelMarco) {
  const [plegado, setPlegado] = useState(() => {
    try {
      return localStorage.getItem('abasto-dock') === 'plegado' || window.innerWidth < 1100;
    } catch {
      return false;
    }
  });
  const [busqueda, setBusqueda] = useState('');
  // La silueta del header se dibuja con el ancho real del header y del menú
  const halo = useRef<HTMLElement>(null);
  const menu = useRef<HTMLElement>(null);
  const [medidas, setMedidas] = useState({ ancho: 0, menu: 0 });
  useEffect(() => {
    const medir = () => setMedidas({ ancho: halo.current?.offsetWidth ?? 0, menu: menu.current?.offsetWidth ?? 0 });
    medir();
    const observador = new ResizeObserver(medir);
    if (halo.current) observador.observe(halo.current);
    if (menu.current) observador.observe(menu.current);
    return () => observador.disconnect();
  }, []);
  const enMas = DE_MAS.some((m) => m.ruta === modulo.ruta);
  const pendientes = alertas.length;

  const plegar = (valor: boolean) => {
    setPlegado(valor);
    try {
      localStorage.setItem('abasto-dock', valor ? 'plegado' : 'abierto');
    } catch {
      // Sin almacenamiento el dock igual se pliega; solo no se recuerda
    }
  };

  const ir = (ruta: string) => (e: MouseEvent) => {
    e.preventDefault();
    navegar(ruta);
  };

  return (
    <div className={`marco ${plegado ? 'dock-plegado' : ''}`}>
      <div className="arriba">
        <header className="halo" ref={halo}>
          <div className="halo-forma" aria-hidden="true" />
          {medidas.ancho > 0 && (
            <svg
              className="halo-silueta"
              width={medidas.ancho}
              height={ALTO_PANZA}
              viewBox={`0 0 ${medidas.ancho} ${ALTO_PANZA}`}
              aria-hidden="true"
            >
              <path d={formaDelHalo(medidas.ancho, medidas.menu)} />
            </svg>
          )}

          <a className="marca" href="/inicio" onClick={ir('inicio')} aria-label="Abasto, ir al inicio">
            <span className="marca-brillo" aria-hidden="true" />
            <Simbolo tamano={50} />
            <span className="marca-texto">
              <strong>Abasto</strong>
              <small>Panel Mayorista</small>
            </span>
          </a>

          <div className="halo-derecha">
            <Desplegable
              boton={(abierto, alternar) => (
                <button className="campana" onClick={alternar} aria-expanded={abierto} aria-label="Buscar en Abasto" title="Buscar">
                  <Icono nombre="buscar" tamano={26} />
                </button>
              )}
            >
              {(cerrar) => (
                <form
                  className="flotante buscador-flotante"
                  role="search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const destino = destinoDeBusqueda(busqueda);
                    if (!destino) return;
                    navegar(destino);
                    document.dispatchEvent(new CustomEvent('abasto:buscar', { detail: { texto: busqueda.trim() } }));
                    setBusqueda('');
                    cerrar();
                  }}
                >
                  <Icono nombre="buscar" />
                  <input
                    autoFocus
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Un producto o un pedido (A-1342)"
                    aria-label="Buscar productos o un pedido por su código"
                  />
                </form>
              )}
            </Desplegable>
            <Desplegable
              boton={(abierto, alternar) => (
                <button
                  className="campana"
                  onClick={alternar}
                  aria-expanded={abierto}
                  aria-label={pendientes ? `Alertas: ${pendientes} esperando` : 'Alertas'}
                >
                  <Icono nombre="alertas" tamano={26} />
                  {pendientes > 0 && <span className="punto-lima" />}
                </button>
              )}
            >
              {(cerrar) => <ListaDeAlertas alertas={alertas} navegar={navegar} cerrar={cerrar} />}
            </Desplegable>
            <span className="separador" aria-hidden="true" />
            <Desplegable
              boton={(abierto, alternar) => (
                <button className="perfil" onClick={alternar} aria-expanded={abierto}>
                  <span className="avatar">
                    <Icono nombre="usuario" />
                  </span>
                  <span className="perfil-nombre">{usuario.nombre}</span>
                  <Icono nombre="abajo" tamano={18} />
                </button>
              )}
            >
              {() => (
                <div className="flotante menu-perfil" role="menu">
                  <p className="flotante-titulo">{usuario.nombre}</p>
                  <p className="flotante-vacio">{usuario.orgNombre || usuario.orgId}</p>
                  {usuario.roles.includes('admin') && (
                    <a className="opcion" href={APPS.superadmin} role="menuitem">
                      <Icono nombre="apps" tamano={18} /> Ir al Superadmin
                    </a>
                  )}
                  <button className="opcion" role="menuitem" onClick={salir}>
                    <Icono nombre="salir" tamano={18} /> Salir
                  </button>
                </div>
              )}
            </Desplegable>
          </div>
        </header>

        <nav className="menu-flotante" aria-label="Secciones" ref={menu}>
          {PRINCIPALES.map((m) => (
            <a
              key={m.ruta}
              href={`/${m.ruta}`}
              className={[m.ruta === modulo.ruta ? 'activo' : '', m.soloEscritorio ? 'solo-escritorio' : ''].join(' ').trim() || undefined}
              aria-current={m.ruta === modulo.ruta ? 'page' : undefined}
              onClick={ir(m.ruta)}
            >
              <Icono nombre={m.icono} tamano={23} />
              <span>{m.titulo}</span>
            </a>
          ))}
          <Desplegable
            clase="mas"
            boton={(abierto, alternar) => (
              <button className={enMas ? 'activo' : undefined} onClick={alternar} aria-expanded={abierto}>
                <Icono nombre={enMas ? modulo.icono : 'mas'} tamano={23} />
                <span>{enMas ? modulo.titulo.split(' ')[0] : 'Más'}</span>
              </button>
            )}
          >
            {(cerrar) => (
              <div className="flotante menu-mas" role="menu">
                {[...PRINCIPALES.filter((m) => m.soloEscritorio), ...DE_MAS].map((m) => (
                  <a
                    key={m.ruta}
                    className={`opcion ${m.ruta === modulo.ruta ? 'elegida' : ''} ${m.soloEscritorio ? 'solo-telefono' : ''}`}
                    href={`/${m.ruta}`}
                    role="menuitem"
                    onClick={(e) => {
                      ir(m.ruta)(e);
                      cerrar();
                    }}
                  >
                    <Icono nombre={m.icono} tamano={18} /> {m.titulo}
                  </a>
                ))}
              </div>
            )}
          </Desplegable>
        </nav>
      </div>

      <aside className="dock" aria-label="Accesos rápidos">
        <button
          className="lengueta"
          onClick={() => plegar(!plegado)}
          aria-label={plegado ? 'Mostrar los accesos rápidos' : 'Esconder los accesos rápidos'}
          aria-expanded={!plegado}
        >
          <Icono nombre="desplegar" tamano={22} />
        </button>
        <div className="dock-cuerpo">
          <Desplegable
            boton={(abierto, alternar) => (
              <button className="acceso" onClick={alternar} aria-expanded={abierto}>
                <span className="disco">
                  <Icono nombre="alertas" />
                  {pendientes > 0 && <span className="burbuja">{pendientes > 99 ? '99+' : pendientes}</span>}
                </span>
                <span className="etiqueta">Alertas</span>
              </button>
            )}
          >
            {(cerrar) => <ListaDeAlertas alertas={alertas} navegar={navegar} cerrar={cerrar} />}
          </Desplegable>
          {ACCESOS_DEL_DOCK.map((m) => (
            <a
              key={m.ruta}
              className={`acceso ${m.ruta === modulo.ruta ? 'activo' : ''}`}
              href={`/${m.ruta}`}
              onClick={ir(m.ruta)}
            >
              <span className="disco">
                <Icono nombre={m.icono} />
              </span>
              <span className="etiqueta">{m.corto ?? m.titulo}</span>
            </a>
          ))}
          <Desplegable
            boton={(abierto, alternar) => (
              <button className="acceso" onClick={alternar} aria-expanded={abierto}>
                <span className="disco">
                  <Icono nombre="ayuda" />
                </span>
                <span className="etiqueta">Ayuda</span>
              </button>
            )}
          >
            {() => (
              <div className="flotante ayuda" role="dialog" aria-label="Ayuda">
                <p className="flotante-titulo">¿Qué hago en cada parte?</p>
                <dl>
                  {AYUDA.map(([t, d]) => (
                    <div key={t}>
                      <dt>{t}</dt>
                      <dd>{d}</dd>
                    </div>
                  ))}
                </dl>
                <p className="flotante-vacio">¿Dudas? Escríbenos a ventas@abasto.bo</p>
              </div>
            )}
          </Desplegable>
        </div>
      </aside>

      {children}
    </div>
  );
}
