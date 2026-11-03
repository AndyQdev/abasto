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
     * @return array<string, mixed>
     */
    public function __invoke(array $representacion): array
    {
        $vista = $this->catalogo->uno($representacion['id'], Usuario::actual()->orgId);

        // El __typename le dice a la unión _Entity qué tipo es. Un pedido viejo puede tener un producto que ya no
        // existe: se devuelve igual, con un nombre que lo dice, para no vaciar la lista de pedidos de nadie
        return ['__typename' => 'Producto'] + ($vista === null
            ? Vistas::productoQueYaNoEsta($representacion['id'])
            : Vistas::producto($vista));
    }
}
