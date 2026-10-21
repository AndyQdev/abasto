import { useEffect, useState } from 'react';
import type { Usuario } from '@abasto/sesion';
import { agregar, type ItemDeCarrito } from './carrito';
import { Carrito } from './pantallas/Carrito';
import { Cuenta } from './pantallas/Cuenta';
import { Inicio } from './pantallas/Inicio';
import { Pedidos } from './pantallas/Pedidos';
import { bandeja, guardado } from './servicios';

type Pestana = 'inicio' | 'carrito' | 'pedidos' | 'cuenta';

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

export function App({ usuario }: { usuario: Usuario }) {
  const enLinea = useEnLinea();
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [carrito, setCarrito] = useState<ItemDeCarrito[]>(() => guardado.leer<ItemDeCarrito[]>('carrito') ?? []);

  useEffect(() => guardado.escribir('carrito', carrito), [carrito]);

  // Al volver la red y al abrir la app se manda la bandeja. Safari en iPhone no tiene Background Sync.
  useEffect(() => {
    if (enLinea) void bandeja.sincronizar();
  }, [enLinea]);

  return (
    <div className="mercado">
      {!enLinea && <div className="aviso-sin-senal">Sin conexión · usas tus datos guardados</div>}
      <header className="barra">
        <strong>Abasto</strong>
        <span className="gris">{usuario.orgNombre} · Santa Cruz</span>
      </header>

      <main>
        {pestana === 'inicio' && <Inicio enLinea={enLinea} alAgregar={(i) => setCarrito((c) => agregar(c, i))} />}
        {pestana === 'carrito' && (
          <Carrito carrito={carrito} enLinea={enLinea} alCambiar={setCarrito} alTerminar={() => setPestana('pedidos')} />
        )}
        {pestana === 'pedidos' && <Pedidos enLinea={enLinea} />}
        {pestana === 'cuenta' && <Cuenta usuario={usuario} />}
      </main>

      <nav className="inferior" aria-label="Secciones">
        {(
          [
            ['inicio', 'Inicio'],
            ['carrito', `Carrito${carrito.length ? ` (${carrito.length})` : ''}`],
            ['pedidos', 'Pedidos'],
            ['cuenta', 'Cuenta'],
          ] as [Pestana, string][]
        ).map(([id, texto]) => (
          <button key={id} className={pestana === id ? 'activo' : undefined} onClick={() => setPestana(id)}>
            {texto}
          </button>
        ))}
      </nav>
    </div>
  );
}
