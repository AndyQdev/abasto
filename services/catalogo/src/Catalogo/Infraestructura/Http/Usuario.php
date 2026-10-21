<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Http;

use GraphQL\Error\Error;

/** Quien llama, sacado del token de Keycloak por el middleware ValidarTokenKeycloak. */
final readonly class Usuario
{
    /** @param list<string> $roles */
    public function __construct(public string $id, public string $orgId, public array $roles)
    {
    }

    public static function actual(): self
    {
        $usuario = request()->attributes->get('usuario');
        if (!$usuario instanceof self) {
            throw new Error('Falta la sesión', extensions: ['code' => 'UNAUTHENTICATED']);
        }

        return $usuario;
    }

    public function exigirRol(string $rol): self
    {
        if (!in_array($rol, $this->roles, true)) {
            throw new Error("Esta acción es para el rol {$rol}", extensions: ['code' => 'FORBIDDEN']);
        }

        return $this;
    }
}
