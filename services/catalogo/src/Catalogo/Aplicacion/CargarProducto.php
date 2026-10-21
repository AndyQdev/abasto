<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;

/**
 * Caso de uso de Abasto Campo: el mayorista sacó la foto en el puesto, el teléfono reconoció el producto
 * y leyó el precio del cartel. Entra como "pendiente de revisión" hasta que el mayorista lo confirma en el Panel.
 */
final readonly class CargarProducto
{
    public function __construct(private ProductoRepositorio $productos)
    {
    }

    public function ejecutar(
        string $mayoristaId,
        string $nombre,
        string $rubro,
        Presentacion $presentacion,
        int $unidades,
        int $precioUnitarioCentavos,
    ): Producto {
        $id = $this->productos->siguienteId();
        $producto = new Producto(
            id: $id,
            mayoristaId: $mayoristaId,
            codigo: strtoupper(substr($id, -6)),
            nombre: $nombre,
            rubro: $rubro,
            descripcion: '',
            stock: 0,
            estado: EstadoProducto::PENDIENTE_DE_REVISION,
            escalas: [new EscalaDePrecio($presentacion, $unidades, $precioUnitarioCentavos)],
        );
        $this->productos->guardar($producto);

        return $producto;
    }
}
