/**
 * CU-01 · Registrarse como mayorista. El formulario es público (sin sesión): `/registro` en el Panel.
 * Catálogo crea la cuenta en Keycloak y la empresa PENDIENTE; Abasto la verifica en el Superadmin.
 * Aquí se adelantan las mismas reglas de Catálogo para avisar antes de enviar.
 */
export interface DatosDeRegistro {
  empresa: string;
  nit: string;
  ciudad: string;
  representante: string;
  telefono: string;
  correo: string;
  clave: string;
}

export const CIUDADES = ['Santa Cruz', 'La Paz', 'El Alto', 'Cochabamba', 'Sucre', 'Oruro', 'Potosí', 'Tarija', 'Trinidad', 'Cobija'];

export const VACIO: DatosDeRegistro = { empresa: '', nit: '', ciudad: 'Santa Cruz', representante: '', telefono: '', correo: '', clave: '' };

export const REGISTRAR = `mutation Registrar($entrada: RegistrarMayoristaEntrada!) {
  registrarMayorista(entrada: $entrada) { id nombre estadoVerificacion }
}`;

/** El primer problema de cada campo, en palabras; vacío si todo está bien. */
export function revisar(d: DatosDeRegistro): Partial<Record<keyof DatosDeRegistro, string>> {
  const e: Partial<Record<keyof DatosDeRegistro, string>> = {};
  const nit = d.nit.replace(/\D/g, '');
  if (d.empresa.trim().length < 3) e.empresa = 'Escribe el nombre de la empresa';
  if (nit.length < 6 || nit.length > 12) e.nit = 'El NIT tiene entre 6 y 12 dígitos';
  if (!d.ciudad) e.ciudad = 'Elige la ciudad';
  if (!d.representante.trim().includes(' ')) e.representante = 'Nombre y apellido';
  if (d.telefono.replace(/[^\d]/g, '').length < 7) e.telefono = 'El teléfono no es válido';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo.trim())) e.correo = 'El correo no es válido';
  if (d.clave.length < 8) e.clave = 'Al menos 8 caracteres';
  return e;
}

/** Lo que se manda: sin espacios de más; el NIT y el teléfono, solo con dígitos. */
export function limpiar(d: DatosDeRegistro): DatosDeRegistro {
  return {
    empresa: d.empresa.trim().replace(/\s+/g, ' '),
    nit: d.nit.replace(/\D/g, ''),
    ciudad: d.ciudad,
    representante: d.representante.trim().replace(/\s+/g, ' '),
    telefono: d.telefono.replace(/[^\d+]/g, ''),
    correo: d.correo.trim().toLowerCase(),
    clave: d.clave,
  };
}

/** Catálogo ya manda el motivo en palabras («Ya hay una cuenta con ese correo»); sin red, se dice así. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof TypeError) return 'No pudimos conectarnos. Revisa tu internet y vuelve a intentar.';
  return e instanceof Error ? e.message : String(e);
}

/** Registrar no necesita sesión: va directo al Router. */
export async function registrar(router: string, d: DatosDeRegistro): Promise<{ id: string; nombre: string }> {
  const r = await fetch(router, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: REGISTRAR, variables: { entrada: limpiar(d) } }),
  });
  const cuerpo = (await r.json()) as { data?: { registrarMayorista: { id: string; nombre: string } } | null; errors?: { message: string }[] };
  if (!cuerpo.data?.registrarMayorista) throw new Error(cuerpo.errors?.[0]?.message ?? `El Router respondió ${r.status}`);
  return cuerpo.data.registrarMayorista;
}
