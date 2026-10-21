import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/** Lo que Abasto sabe de quien llama, sacado del token de Keycloak. */
export interface Usuario {
  id: string;
  correo?: string;
  orgId: string;
  roles: string[];
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
  };
}

/** Guard global: toda petición necesita un token válido salvo las marcadas con @Publico(). */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;

    const peticion =
      contexto.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(contexto).getContext().req
        : contexto.switchToHttp().getRequest();

    const cabecera: string | undefined = peticion?.headers?.authorization;
    if (!cabecera?.startsWith('Bearer ')) throw new UnauthorizedException('Falta la sesión');
    try {
      peticion.usuario = await verificarToken(cabecera.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException('La sesión no es válida o venció');
    }
  }
}
