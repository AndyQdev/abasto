<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\RelacionComercial;

interface RelacionRepositorio
{
    public function de(string $tiendaId, string $mayoristaId): ?RelacionComercial;

    /** @return array<string, RelacionComercial> relaciones de una tienda, por id de mayorista */
    public function deTienda(string $tiendaId): array;

    /** @return list<RelacionComercial> solicitudes pendientes que recibió un mayorista */
    public function solicitudesDe(string $mayoristaId): array;

    /** @return list<RelacionComercial> tiendas que un mayorista ya aprobó como clientes */
    public function aprobadasDe(string $mayoristaId): array;

    public function guardar(RelacionComercial $relacion): void;
}
