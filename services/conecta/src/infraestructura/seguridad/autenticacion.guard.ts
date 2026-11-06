import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { LlavesDeApi } from '../../aplicacion/llaves-de-api.js';
import { esLlave } from '../../dominio/llave-de-api.js';

/** Lo que Abasto sabe de quien llama, sacado del token de Keycloak. */
export interface Usuario {
  id: string;
  correo?: string;
  orgId: string;
  roles: string[];
  /** Cuándo vence el token (ms desde 1970); el canal en tiempo real cierra ahí para que la app entre con uno nuevo */
  venceEn?: number;
  /** Entró con una llave de API (CU-10), no una persona con su sesión */
  porLlave?: boolean;
}

const PUBLICO = 'abasto:publico';
/** Marca una ruta que no pide sesión, como /salud. */
export const Publico = () => SetMetadata(PUBLICO, true);

const emisor = process.env.KEYCLOAK_ISSUER ?? 'http://localhost:8180/realms/abasto';
const llaves = createRemoteJWKSet(
  new URL(process.env.KEYCLOAK_JWKS_URL ?? `${emisor}/protocol/openid-connect/certs`),
);

export async function verificarToken(token: string): Promise<Usuario> {
  const { payload } = await jwtVerify<JWTPayload & Record<string, unknown>>(token, llaves, {
    issuer: emisor,
    audience: 'abasto-api',
  });
  const acceso = payload.realm_access as { roles?: string[] } | undefined;
  return {
    id: String(payload.sub),
    correo: payload.email as string | undefined,
    orgId: typeof payload.org_id === 'string' ? payload.org_id : '',
    roles: acceso?.roles ?? [],
    venceEn: typeof payload.exp === 'number' ? payload.exp * 1000 : undefined,
  };
}

/** Guard global: toda petición necesita un token válido salvo las marcadas con @Publico(). */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(LlavesDeApi) private readonly llaves: LlavesDeApi,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;

    const peticion = contexto.switchToHttp().getRequest();

    const cabecera: string | undefined = peticion?.headers?.authorization;
    if (!cabecera?.startsWith('Bearer ')) throw new UnauthorizedException('Falta la sesión');
    const credencial = cabecera.slice(7);
    try {
      if (esLlave(credencial)) {
        const token = await this.llaves.autenticar(credencial);
        if (!token) throw new Error('Llave inválida');
        peticion.usuario = { ...(await verificarToken(token)), porLlave: true };
        peticion.token = token;
        return true;
      }
      peticion.usuario = await verificarToken(credencial);
      peticion.token = credencial;
      return true;
    } catch {
      throw new UnauthorizedException('La sesión no es válida o venció');
    }
  }
}
