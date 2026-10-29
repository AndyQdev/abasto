<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Catalogo\Dominio\Puertos\PublicadorDeEventos;
use Catalogo\Dominio\ReservaDeStock;

/**
 * Publica `producto.stock_cambiado` con el stock que quedó en cada producto de una reserva.
 * Lo escucha el proyector del Asistente para que los reportes de stock estén al día.
 * La clave incluye el movimiento y el producto: reservar y liberar el mismo pedido son dos avisos distintos.
 */
final readonly class AvisoDeStock
{
    public function __construct(
        private ProductoRepositorio $productos,
        private PublicadorDeEventos $eventos,
    ) {}

    public function avisar(string $movimiento, ReservaDeStock $reserva, string $mayoristaId): void
    {
        $productoIds = array_unique(array_map(static fn ($l) => $l->productoId, $reserva->lineas()));
        foreach ($productoIds as $productoId) {
            $producto = $this->productos->porId($productoId);
            if ($producto === null) {
                continue;
            }
            $this->eventos->publicar('producto.stock_cambiado', $reserva->pedidoId, $mayoristaId, [
                'productoId' => $producto->id,
                'nombre' => $producto->nombre,
                'stock' => $producto->stock,
            ], "{$movimiento}:{$reserva->pedidoId}:{$producto->id}");
        }
    }
}
