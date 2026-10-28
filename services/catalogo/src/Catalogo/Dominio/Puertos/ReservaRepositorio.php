<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\ReservaDeStock;

interface ReservaRepositorio
{
    public function de(string $pedidoId): ?ReservaDeStock;

    public function guardar(ReservaDeStock $reserva): void;
}
