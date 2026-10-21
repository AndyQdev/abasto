<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\GraphQL\Entidades;

use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Catalogo\Infraestructura\GraphQL\Vistas;

/** Federación: Pedidos y Cobros devuelven { tienda { id } } y el nombre sale de aquí. */
final readonly class Tienda
{
    public function __construct(private OrganizacionRepositorio $organizaciones)
    {
    }

    /**
     * @param  array{id: string}  $representacion
     * @return array<string, mixed>
     */
    public function __invoke(array $representacion): array
    {
        return ['__typename' => 'Tienda'] + Vistas::tienda($this->organizaciones->porId($representacion['id']), $representacion['id']);
    }
}
