<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Catalogo\Dominio\Puertos\PublicadorDeEventos;
use Catalogo\Dominio\Puertos\ReservaRepositorio;

/**
 * Compensación de la saga: si falló el cobro o venció el plazo, el stock apartado vuelve al producto.
 * Si no había reserva o ya estaba liberada no devuelve nada, pero igual responde `stock.liberado`
 * (con el mismo id, así que Pedidos no lo cuenta dos veces) para que la saga pueda cerrar.
 */
final readonly class LiberarStock
{
    public function __construct(
        private ProductoRepositorio $productos,
        private ReservaRepositorio $reservas,
        private PublicadorDeEventos $eventos,
    ) {}

    public function ejecutar(string $pedidoId, string $mayoristaId): void
    {
        $reserva = $this->reservas->de($pedidoId);
        if ($reserva !== null && $reserva->tieneStockPorDevolver()) {
            foreach ($reserva->lineas() as $linea) {
                // Lo que se pidió bajo pedido no descontó stock: no hay nada que devolver
                if ($linea->descontado) {
                    $this->productos->devolverStock($linea->productoId, $linea->unidades);
                }
            }
            $reserva->liberar();
            $this->reservas->guardar($reserva);
            (new AvisoDeStock($this->productos, $this->eventos))->avisar('liberacion', $reserva, $mayoristaId);
        }

        $this->eventos->publicar('stock.liberado', $pedidoId, $mayoristaId, ['pedidoId' => $pedidoId]);
    }
}
