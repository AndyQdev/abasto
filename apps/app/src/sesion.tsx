import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { cerrarEnKeycloak, renovar, SesionVencida, type Tokens } from './keycloak';

/** Lo que la app sabe de quien entró, sacado del token de Keycloak. */
export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  orgId: string;
  orgNombre: string;
  /** Los 8 dígitos, si entró con su celular */
  telefono: string;
  roles: string[];
}

const CLAVE = 'abasto.sesion';

/** Los tokens van al llavero del teléfono; en la vista web de desarrollo, a localStorage. */
const llavero = {
  async leer(): Promise<Tokens | null> {
    try {
      const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(CLAVE) : await SecureStore.getItemAsync(CLAVE);
      return v ? (JSON.parse(v) as Tokens) : null;
    } catch {
      return null;
    }
  },
  async escribir(t: Tokens | null) {
    const valor = t ? JSON.stringify(t) : null;
    if (Platform.OS === 'web') {
      if (valor) globalThis.localStorage?.setItem(CLAVE, valor);
      else globalThis.localStorage?.removeItem(CLAVE);
      return;
    }
    if (valor) await SecureStore.setItemAsync(CLAVE, valor);
    else await SecureStore.deleteItemAsync(CLAVE);
  },
};

/** Lee el cuerpo de un JWT (base64url) sin verificarlo: la verificación la hace cada servicio. */
export function leerToken(jwt: string): Record<string, unknown> {
  const cuerpo = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const relleno = cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4);
  const binario = globalThis.atob(relleno);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

export function usuarioDe(jwt: string): Usuario {
  const p = leerToken(jwt);
  const roles = ((p.realm_access as { roles?: string[] } | undefined)?.roles ?? []).filter(
    (r) => !r.startsWith('default-roles') && r !== 'offline_access' && r !== 'uma_authorization',
  );
  return {
    id: String(p.sub ?? ''),
    nombre: String(p.name ?? p.preferred_username ?? ''),
    correo: String(p.email ?? ''),
    orgId: String(p.org_id ?? ''),
    orgNombre: String(p.org_nombre ?? p.name ?? ''),
    telefono: /^591\d{8}$/.test(String(p.preferred_username)) ? String(p.preferred_username).slice(3) : '',
    roles,
  };
}

interface Sesion {
  usuario: Usuario | null;
  /** Mientras se lee el llavero al abrir la app */
  cargando: boolean;
  /** Guarda la sesión que devolvió entrarConCodigo (src/acceso.ts). Desde ahí la app no vuelve a pedir el celular. */
  iniciar: (tokens: Tokens) => Promise<void>;
  salir: () => Promise<void>;
  /** Token vigente (lo renueva si está por vencer). Null si no hay sesión. */
  token: () => Promise<string | null>;
}

const Contexto = createContext<Sesion | null>(null);

/** El token que usan los servicios fuera de React (bandeja, GraphQL). Lo fija el proveedor. */
let tokenGlobal: () => Promise<string | null> = async () => null;
export const tokenActual = () => tokenGlobal();

export function ProveedorDeSesion({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [cargando, setCargando] = useState(true);
  const tokensRef = useRef<Tokens | null>(null);

  const guardar = useCallback(async (t: Tokens | null) => {
    tokensRef.current = t;
    setTokens(t);
    await llavero.escribir(t);
  }, []);

  useEffect(() => {
    void llavero.leer().then((t) => {
      tokensRef.current = t;
      setTokens(t);
      setCargando(false);
    });
  }, []);

  const token = useCallback(async () => {
    const t = tokensRef.current;
    if (!t) return null;
    if (Date.now() < t.venceEn - 30_000) return t.acceso;
    // Por vencer: se renueva con el refresh token. Sin señal se usa el que hay y el servicio dirá si venció.
    if (!t.refresco) return t.acceso;
    try {
      const r = await renovar(t.refresco);
      const nuevo = { ...r, refresco: r.refresco ?? t.refresco };
      await guardar(nuevo);
      return nuevo.acceso;
    } catch (e) {
      // Keycloak ya no la reconoce: vuelve a la bienvenida. Sin señal, se sigue con lo que hay.
      if (e instanceof SesionVencida) await guardar(null);
      return tokensRef.current?.acceso ?? null;
    }
  }, [guardar]);

  useEffect(() => {
    tokenGlobal = token;
  }, [token]);

  const valor = useMemo<Sesion>(
    () => ({
      usuario: tokens ? usuarioDe(tokens.acceso) : null,
      cargando,
      token,
      iniciar: guardar,
      salir: async () => {
        const refresco = tokensRef.current?.refresco;
        await guardar(null);
        if (refresco) await cerrarEnKeycloak(refresco);
      },
    }),
    [tokens, cargando, token, guardar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSesion fuera de ProveedorDeSesion');
  return s;
}
