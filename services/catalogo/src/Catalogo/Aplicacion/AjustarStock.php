<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Catalogo\Dominio\Puertos\PublicadorDeEventos;

/**
 * El mayorista corrige el stock de un producto suyo. El estado lo deriva Producto::ajustarStock.
 * Avisa `producto.stock_cambiado` para que los reportes del Asistente vean la corrección.
 */
final readonly class AjustarStock
{
    public function __construct(
        private ProductoRepositorio $productos,
        private PublicadorDeEventos $eventos,
    ) {}

    public function ejecutar(string $productoId, string $mayoristaId, int $nuevoStock): Producto
    {
        $producto = $this->productos->porId($productoId)
            ?? throw new ErrorDeDominio('PRODUCTO_INEXISTENTE', 'El producto no existe o fue dado de baja');
        if ($producto->mayoristaId !== $mayoristaId) {
            throw new ErrorDeDominio('PRODUCTO_AJENO', 'El producto no es de tu empresa');
        }

        $producto->ajustarStock($nuevoStock);
        $this->productos->fijarStock($producto);
        // Cada corrección es un aviso distinto: la clave lleva un sufijo al azar para que el id no se repita
        $this->eventos->publicar('producto.stock_cambiado', $producto->id, $mayoristaId, [
            'productoId' => $producto->id,
            'nombre' => $producto->nombre,
            'stock' => $producto->stock,
        ], "ajuste:{$producto->id}:".bin2hex(random_bytes(8)));

        return $producto;
    }
}
