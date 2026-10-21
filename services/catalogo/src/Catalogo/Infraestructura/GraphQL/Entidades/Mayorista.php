<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\GraphQL\Entidades;

use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Infraestructura\GraphQL\Vistas;
use Catalogo\Infraestructura\Http\Usuario;

final readonly class Mayorista
{
    public function __construct(private OrganizacionRepositorio $organizaciones, private RelacionRepositorio $relaciones)
    {
    }

    /**
     * @param  array{id: string}  $representacion
     * @return array<string, mixed>
     */
    public function __invoke(array $representacion): array
    {
        $id = $representacion['id'];
        $relacion = $this->relaciones->de(Usuario::actual()->orgId, $id);

        return ['__typename' => 'Mayorista'] + Vistas::mayorista($this->organizaciones->porId($id), $id, $relacion?->estado()->value ?? 'NINGUNA');
    }
}
