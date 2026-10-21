<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/** Un mayorista o una tienda. El id es el org_id del token de Keycloak. */
final readonly class Organizacion
{
    public function __construct(
        public string $id,
        public string $nombre,
        public string $tipo,
        public string $ciudad,
        public bool $verificado,
        public ?string $nit = null,
    ) {
    }

    public function esMayorista(): bool
    {
        return $this->tipo === 'mayorista';
    }
}
