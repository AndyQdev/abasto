<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\Puertos\PublicadorDeEventos;

final class EventosGrabados implements PublicadorDeEventos
{
    /** @var list<array{tipo: string, pedidoId: string, orgId: string, datos: array<string, mixed>}> */
    public array $enviados = [];

    public function publicar(string $tipo, string $pedidoId, string $orgId, array $datos): void
    {
        $this->enviados[] = compact('tipo', 'pedidoId', 'orgId', 'datos');
    }
}
