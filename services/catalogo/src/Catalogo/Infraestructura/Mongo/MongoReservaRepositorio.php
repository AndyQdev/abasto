<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mongo;

use Catalogo\Dominio\EstadoReserva;
use Catalogo\Dominio\LineaReservada;
use Catalogo\Dominio\Puertos\ReservaRepositorio;
use Catalogo\Dominio\ReservaDeStock;
use MongoDB\Collection;

/**
 * Colección `reservas`, una por pedido:
 * { _id: pedidoId, estado, motivo, lineas: [{ producto_id, unidades, precio_unitario_centavos }] }
 */
final readonly class MongoReservaRepositorio implements ReservaRepositorio
{
    public function __construct(private Collection $coleccion) {}

    public function de(string $pedidoId): ?ReservaDeStock
    {
        $doc = $this->coleccion->findOne(['_id' => $pedidoId]);
        if ($doc === null) {
            return null;
        }
        $doc = (array) $doc;
        $lineas = [];
        foreach ((array) ($doc['lineas'] ?? []) as $l) {
            $l = (array) $l;
            $lineas[] = new LineaReservada(
                (string) $l['producto_id'],
                (int) $l['unidades'],
                (int) $l['precio_unitario_centavos'],
                (bool) ($l['descontado'] ?? true),
            );
        }

        return ReservaDeStock::rehidratar(
            $pedidoId,
            EstadoReserva::from((string) $doc['estado']),
            $lineas,
            isset($doc['motivo']) ? (string) $doc['motivo'] : null,
        );
    }

    public function guardar(ReservaDeStock $reserva): void
    {
        $this->coleccion->replaceOne(['_id' => $reserva->pedidoId], [
            '_id' => $reserva->pedidoId,
            'estado' => $reserva->estado()->value,
            'motivo' => $reserva->motivo,
            'lineas' => array_map(static fn (LineaReservada $l) => [
                'producto_id' => $l->productoId,
                'unidades' => $l->unidades,
                'precio_unitario_centavos' => $l->precioUnitarioCentavos,
                'descontado' => $l->descontado,
            ], $reserva->lineas()),
        ], ['upsert' => true]);
    }
}
