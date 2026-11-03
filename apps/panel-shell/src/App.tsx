import { useCallback, useEffect, useState } from 'react';
import type { Sesion, Usuario } from '@abasto/sesion';
import { LO_QUE_ESPERA, armarAlertas, type Alerta, type DatosDeAlertas } from './alertas';
import { Marco } from './Marco';
import { Microfrontend } from './Microfrontend';
import { moduloDe } from './navegacion';
import { ROUTER_URL } from './offline/config';
import { useSinSenal } from './offline/useSinSenal';
import { avisoDeVerificacion, MI_ORGANIZACION, type MiOrganizacion } from './verificacion';

const rutaActual = () => window.location.pathname.replace(/^\//, '') || 'inicio';

export function App({ sesion, usuario }: { sesion: Sesion; usuario: Usuario }) {
  const [ruta, setRuta] = useState(rutaActual);
  const [aviso, setAviso] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const modulo = moduloDe(ruta);

  const navegar = useCallback((destino: string) => {
    window.history.pushState({}, '', `/${destino}`);
    setRuta(destino.split('?')[0]);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const atras = () => setRuta(rutaActual());
    // Los remotos piden navegar o mostrar un aviso con eventos que atraviesan el Shadow DOM
    const pedirNavegar = (e: Event) => navegar((e as CustomEvent<{ ruta: string }>).detail.ruta);
    const mostrarAviso = (e: Event) => setAviso((e as CustomEvent<{ texto: string }>).detail.texto);
    window.addEventListener('popstate', atras);
    document.addEventListener('abasto:navegar', pedirNavegar);
    document.addEventListener('abasto:aviso', mostrarAviso);
    return () => {
      window.removeEventListener('popstate', atras);
      document.removeEventListener('abasto:navegar', pedirNavegar);
      document.removeEventListener('abasto:aviso', mostrarAviso);
    };
  }, [navegar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const token = useCallback(() => sesion.token(), [sesion]);
  const conexion = useSinSenal(token, setAviso);
  const esMayorista = usuario.roles.includes('mayorista');
  const [organizacion, setOrganizacion] = useState<MiOrganizacion | null>(null);

  // CU-01: el mayorista recién registrado ve si está en revisión o por qué lo rechazaron
  useEffect(() => {
    if (!esMayorista) return;
    let vigente = true;
    void (async () => {
      try {
        const r = await fetch(ROUTER_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${await sesion.token()}` },
          body: JSON.stringify({ query: MI_ORGANIZACION }),
        });
        const cuerpo = (await r.json()) as { data?: { miOrganizacion: MiOrganizacion } };
        if (vigente && cuerpo.data) setOrganizacion(cuerpo.data.miOrganizacion);
      } catch {
        // Sin señal no se muestra el aviso: no es motivo para frenar el Panel
      }
    })();
    return () => {
      vigente = false;
    };
  }, [esMayorista, sesion]);
  const verificacion = avisoDeVerificacion(organizacion);

  // La campana y el dock: lo que espera una decisión. Se refresca cada minuto y después de cada acción (aviso)
  useEffect(() => {
    if (!esMayorista) return;
    let vigente = true;
    const cargar = async () => {
      try {
        const r = await fetch(ROUTER_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${await sesion.token()}` },
          body: JSON.stringify({ query: LO_QUE_ESPERA }),
        });
        const cuerpo = (await r.json()) as { data?: DatosDeAlertas };
        if (vigente && cuerpo.data) setAlertas(armarAlertas(cuerpo.data));
      } catch {
        // Sin señal se quedan las últimas alertas
      }
    };
    void cargar();
    const cada = setInterval(() => void cargar(), 60_000);
    const alAvisar = () => setTimeout(() => void cargar(), 800);
    document.addEventListener('abasto:aviso', alAvisar);
    return () => {
      vigente = false;
      clearInterval(cada);
      document.removeEventListener('abasto:aviso', alAvisar);
    };
  }, [esMayorista, sesion]);

  return (
    <Marco usuario={usuario} modulo={modulo} alertas={alertas} navegar={navegar} salir={() => void sesion.cerrar()}>
      <main className="contenido">
        {(!conexion.enLinea || conexion.pendientes > 0 || conexion.desdeCache) && (
          <div className={`sin-senal ${conexion.enLinea ? 'enviando' : ''}`} role="status">
            {conexion.enLinea ? 'Volvió la señal' : 'Sin conexión: ves los últimos datos guardados'}
            {conexion.pendientes > 0 && ` · ${conexion.pendientes} cambios esperando para enviarse`}
          </div>
        )}

        {verificacion && (
          <div className={`verificacion ${verificacion.tono}`} role="status">
            <strong>{verificacion.titulo}</strong>
            <span>{verificacion.detalle}</span>
          </div>
        )}

        {esMayorista ? (
          <Microfrontend remoto={modulo.remoto} ruta={modulo.ruta} sesion={sesion} usuario={usuario} />
        ) : (
          <div className="carta">
            <strong>Tu cuenta no es de un mayorista.</strong>
            <p>
              El Panel es para vender. Para comprar, usa la app Abasto en tu teléfono con esta misma
              cuenta.
            </p>
          </div>
        )}
      </main>

      {aviso && (
        <div className="aviso" role="status">
          {aviso}
        </div>
      )}
    </Marco>
  );
}
