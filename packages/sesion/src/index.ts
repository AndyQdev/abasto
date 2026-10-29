import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

/**
 * Sesión única de Abasto (Keycloak con OpenID Connect y PKCE).
 * Mercado, el Panel y el Superadmin usan cada uno su cliente, pero la sesión de Keycloak es la misma:
 * si ya entraste en una app, en la otra no se vuelve a pedir la contraseña.
 */
export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  orgId: string;
  orgNombre: string;
  roles: string[];
}

export interface Sesion {
  /** Devuelve el usuario si hay sesión; si no, manda a Keycloak y la promesa no resuelve. */
  asegurar(): Promise<Usuario>;
  token(): Promise<string>;
  cerrar(): Promise<void>;
  usuario(): Usuario | null;
}

export interface OpcionesDeSesion {
  clientId: 'abasto-panel' | 'abasto-superadmin';
  emisor?: string;
}

const EMISOR = 'http://localhost:8180/realms/abasto';

function aUsuario(u: User): Usuario {
  const p = u.profile as Record<string, unknown>;
  const acceso = p.realm_access as { roles?: string[] } | undefined;
  const roles = acceso?.roles ?? (rolesDelToken(u.access_token) ?? []);
  return {
    id: String(p.sub),
    nombre: String(p.name ?? p.preferred_username ?? ''),
    correo: String(p.email ?? ''),
    orgId: String(p.org_id ?? ''),
    orgNombre: String(p.org_nombre ?? ''),
    roles,
  };
}

/** Los roles vienen en el token de acceso (realm_access.roles), no siempre en el perfil. */
function rolesDelToken(token: string): string[] | undefined {
  try {
    const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return carga.realm_access?.roles;
  } catch {
    return undefined;
  }
}

export function crearSesion({ clientId, emisor = EMISOR }: OpcionesDeSesion): Sesion {
  const gestor = new UserManager({
    authority: emisor,
    client_id: clientId,
    redirect_uri: `${window.location.origin}/`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });
  let actual: Usuario | null = null;

  return {
    async asegurar() {
      if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
        const u = await gestor.signinRedirectCallback();
        // Vuelve a la pantalla que se pidió antes de ir a Keycloak
        const destino = typeof u.state === 'string' && u.state.startsWith('/') ? u.state : window.location.pathname;
        window.history.replaceState({}, '', destino);
        actual = aUsuario(u);
        return actual;
      }
      const u = await gestor.getUser();
      if (u && !u.expired) {
        actual = aUsuario(u);
        return actual;
      }
      await gestor.signinRedirect({ state: window.location.pathname });
      return new Promise<Usuario>(() => {});
    },
    async token() {
      const u = await gestor.getUser();
      if (!u || u.expired) {
        await gestor.signinRedirect();
        return new Promise<string>(() => {});
      }
      return u.access_token;
    },
    async cerrar() {
      await gestor.signoutRedirect();
    },
    usuario: () => actual,
  };
}

/** Direcciones de las apps, para pasar de una a otra con la misma sesión. */
export const APPS = {
  panel: 'http://localhost:5170/',
  superadmin: 'http://localhost:5174/',
} as const;
