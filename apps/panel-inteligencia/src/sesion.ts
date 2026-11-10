/** Lo que el Shell le pasa como propiedad `sesion` (contracts/microfrontends.md). */
export interface SesionDelShell {
  token: () => Promise<string>;
  usuario: { id: string; nombre: string; orgId: string; orgNombre: string; roles: string[] };
  urls: { router: string; asistente: string; conecta: string };
}

/** Llama a Asistente con el token de la sesión. Lanza con el mensaje que manda el servicio. */
/** Error del Asistente. Si la pregunta era ambigua, trae `opciones`: preguntas que sí sabe responder. */
export class ErrorDelAsistente extends Error {
  readonly opciones: string[];
  constructor(mensaje: string, opciones: string[] = []) {
    super(mensaje);
    this.opciones = opciones;
  }
}

export async function llamarAsistente<T>(
  sesion: SesionDelShell,
  ruta: string,
  opciones: { metodo?: 'GET' | 'POST'; cuerpo?: unknown } = {},
): Promise<T> {
  const respuesta = await fetch(`${sesion.urls.asistente}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await sesion.token()}` },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  if (!respuesta.ok) {
    const error = (await respuesta.json().catch(() => ({}))) as { message?: string | string[]; opciones?: string[] };
    const mensaje = [error.message].flat().join(' ') || `Asistente respondió ${respuesta.status}`;
    throw new ErrorDelAsistente(mensaje, error.opciones ?? []);
  }
  return respuesta.headers.get('content-type')?.includes('json') ? respuesta.json() : (respuesta.blob() as Promise<T>);
}

const formatoBs = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Columnas *_centavos se muestran en bolivianos; las fechas, dd/mm/aaaa. */
export function formatearCelda(columna: string, valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (columna.endsWith('_centavos')) return `Bs ${formatoBs.format(Number(valor) / 100)}`;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-');
    return `${d}/${m}/${a}`;
  }
  return String(valor);
}

export function encabezado(columna: string): string {
  return columna.replace(/_centavos$/, '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
