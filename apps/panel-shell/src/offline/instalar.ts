import { useEffect, useState } from 'react';

/**
 * «Instalar el Panel» (PWA): Chrome y Edge avisan con beforeinstallprompt cuando el Panel se puede instalar.
 * Se escucha apenas carga el Shell, porque el aviso puede llegar antes de que se dibuje el menú.
 * Instalado, el Panel abre en su propia ventana y sigue andando sin señal (pedidos guardados, la bandeja de
 * cambios y la IA local del navegador).
 */
interface AvisoDeInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let aviso: AvisoDeInstalacion | null = null;
const interesados = new Set<() => void>();
const contar = () => interesados.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // sin la barra automática del navegador: se ofrece en el menú del perfil
    aviso = e as AvisoDeInstalacion;
    contar();
  });
  window.addEventListener('appinstalled', () => {
    aviso = null;
    contar();
  });
}

/** Devuelve la acción de instalar si el navegador lo permite ahora; si no (ya instalado, Firefox, Safari), null. */
export function usePuedeInstalarse(): (() => void) | null {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    interesados.add(f);
    return () => void interesados.delete(f);
  }, []);
  if (!aviso) return null;
  const actual = aviso;
  return () => {
    void actual.prompt();
    void actual.userChoice.then(() => {
      aviso = null; // el navegador da un solo prompt() por aviso
      contar();
    });
  };
}
