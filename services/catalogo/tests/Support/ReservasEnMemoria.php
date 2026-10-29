<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\Puertos\ReservaRepositorio;
use Catalogo\Dominio\ReservaDeStock;

final class ReservasEnMemoria implements ReservaRepositorio
{
    /** @var array<string, ReservaDeStock> */
    public array $todas = [];

    public function de(string $pedidoId): ?ReservaDeStock
    {
        return $this->todas[$pedidoId] ?? null;
    }

    public function guardar(ReservaDeStock $reserva): void
    {
        $this->todas[$reserva->pedidoId] = $reserva;
    }
}
