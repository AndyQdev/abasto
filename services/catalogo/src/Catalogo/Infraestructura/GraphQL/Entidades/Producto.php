<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\GraphQL\Entidades;

use Catalogo\Aplicacion\ConsultarCatalogo;
use Catalogo\Infraestructura\GraphQL\Vistas;
use Catalogo\Infraestructura\Http\Usuario;

/** Federación: Pedidos devuelve { producto { id } } y el Router le pide aquí el resto de los campos. */
final readonly class Producto
{
    public function __construct(private ConsultarCatalogo $catalogo)
    {
    }

    /**
     * @param  array{id: string}  $representacion
     * @return array<string, mixed>|null
     */
    public function __invoke(array $representacion): ?array
    {
        $vista = $this->catalogo->uno($representacion['id'], Usuario::actual()->orgId);

        // El __typename le dice a la unión _Entity qué tipo es
        return $vista === null ? null : ['__typename' => 'Producto'] + Vistas::producto($vista);
    }
}
