<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\Puertos\PublicadorDeEventos;

final class EventosGrabados implements PublicadorDeEventos
{
    /** @var list<array{tipo: string, pedidoId: string, orgId: string, datos: array<string, mixed>, clave: string}> */
    public array $enviados = [];

    public function publicar(string $tipo, string $pedidoId, string $orgId, array $datos, ?string $clave = null): void
    {
        $clave ??= $pedidoId;
        $this->enviados[] = compact('tipo', 'pedidoId', 'orgId', 'datos', 'clave');
    }

    /** @return list<array{tipo: string, pedidoId: string, orgId: string, datos: array<string, mixed>, clave: string}> */
    public function deTipo(string $tipo): array
    {
        return array_values(array_filter($this->enviados, static fn (array $e) => $e['tipo'] === $tipo));
    }
}
