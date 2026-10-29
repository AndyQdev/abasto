<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;

/** El mayorista corrige el stock de un producto suyo. El estado lo deriva Producto::ajustarStock. */
final readonly class AjustarStock
{
    public function __construct(private ProductoRepositorio $productos)
    {
    }

    public function ejecutar(string $productoId, string $mayoristaId, int $nuevoStock): Producto
    {
        $producto = $this->productos->porId($productoId)
            ?? throw new ErrorDeDominio('PRODUCTO_INEXISTENTE', 'El producto no existe o fue dado de baja');
        if ($producto->mayoristaId !== $mayoristaId) {
            throw new ErrorDeDominio('PRODUCTO_AJENO', 'El producto no es de tu empresa');
        }

        $producto->ajustarStock($nuevoStock);
        $this->productos->fijarStock($producto);

        return $producto;
    }
}
