<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoRelacion;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Producto;

/** Lo que ve quien consulta: el producto y, según la red privada, sus precios o nada. */
final readonly class VistaDeProducto
{
    /** @param list<EscalaDePrecio>|null $escalasVisibles null si quien consulta no puede ver precios */
    public function __construct(
        public Producto $producto,
        public ?Organizacion $mayorista,
        public ?array $escalasVisibles,
        public EstadoRelacion $relacion,
        /** Quien consulta es el dueño: ve el costo y el proveedor */
        public bool $esDelDueno = false,
    ) {
    }
}
