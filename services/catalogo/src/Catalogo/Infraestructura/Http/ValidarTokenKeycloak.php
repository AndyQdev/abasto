<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Http;

use Closure;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Valida el token de Keycloak: firma (llaves del realm), emisor y audiencia `abasto-api`.
 * Las llaves se piden a keycloak:8080 desde Docker, pero el emisor que se valida es localhost:8180,
 * el mismo que ve el navegador. Sin token válido, la petición sigue sin usuario y los resolvers lo rechazan.
 */
final class ValidarTokenKeycloak
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if ($token !== null) {
            try {
                $request->attributes->set('usuario', $this->usuarioDe($token));
            } catch (Throwable $e) {
                Log::warning('Token rechazado: '.$e->getMessage());

                return response()->json(['errors' => [['message' => 'La sesión no es válida o venció']]], 401);
            }
        }

        return $next($request);
    }

    private function usuarioDe(string $token): Usuario
    {
        $emisor = (string) config('services.keycloak.emisor');
        $llaves = Cache::remember('keycloak.jwks', 600, static function () {
            return Http::timeout(5)->get((string) config('services.keycloak.jwks'))->throw()->json();
        });
        $carga = (array) JWT::decode($token, JWK::parseKeySet($llaves, 'RS256'));

        $audiencia = (array) ($carga['aud'] ?? []);
        if (($carga['iss'] ?? null) !== $emisor || !in_array('abasto-api', $audiencia, true)) {
            throw new \UnexpectedValueException('Emisor o audiencia inválidos');
        }

        return new Usuario(
            id: (string) $carga['sub'],
            orgId: (string) ($carga['org_id'] ?? ''),
            roles: array_values((array) (((array) ($carga['realm_access'] ?? []))['roles'] ?? [])),
        );
    }
}
