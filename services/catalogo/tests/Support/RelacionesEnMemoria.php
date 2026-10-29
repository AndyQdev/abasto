<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Dominio\RelacionComercial;

final class RelacionesEnMemoria implements RelacionRepositorio
{
    /** @var array<string, RelacionComercial> */
    public array $todas = [];

    public function de(string $tiendaId, string $mayoristaId): ?RelacionComercial
    {
        return $this->todas["$tiendaId|$mayoristaId"] ?? null;
    }

    public function deTienda(string $tiendaId): array
    {
        return [];
    }

    public function solicitudesDe(string $mayoristaId): array
    {
        return [];
    }

    public function guardar(RelacionComercial $relacion): void
    {
        $this->todas["{$relacion->tiendaId}|{$relacion->mayoristaId}"] = $relacion;
    }
}
