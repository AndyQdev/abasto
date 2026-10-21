<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * Objeto de valor: el precio por unidad cuando se compra en una presentación.
 * Ejemplo: shampoo 400 ml, caja de 48 unidades a Bs 18,00 cada una.
 */
final readonly class EscalaDePrecio
{
    public function __construct(
        public Presentacion $presentacion,
        public int $unidades,
        public int $precioUnitarioCentavos,
    ) {
        if ($unidades <= 0) {
            throw new ErrorDeDominio('ESCALA_INVALIDA', 'Una presentación tiene que traer al menos una unidad');
        }
        if ($precioUnitarioCentavos <= 0) {
            throw new ErrorDeDominio('PRECIO_INVALIDO', 'El precio tiene que ser mayor a cero');
        }
    }

    public function conPorcentaje(int $porcentaje): self
    {
        return new self($this->presentacion, $this->unidades, intdiv($this->precioUnitarioCentavos * $porcentaje + 50, 100));
    }
}
