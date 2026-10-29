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
    ) {
    }
}
