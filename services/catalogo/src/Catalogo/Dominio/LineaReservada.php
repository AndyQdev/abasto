<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/** Objeto de valor: lo que se apartó de un producto y a qué precio unitario quedó. */
final readonly class LineaReservada
{
    public function __construct(
        public string $productoId,
        public int $unidades,
        public int $precioUnitarioCentavos,
        /** false si el producto es bajo pedido: no se descontó stock, así que al liberar no se devuelve */
        public bool $descontado = true,
    ) {
    }
}
