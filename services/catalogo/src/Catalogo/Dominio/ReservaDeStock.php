<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * Entidad: el resultado de reservar el stock de un pedido (paso 2 de la saga).
 * Queda guardada aunque se rechace: si el mismo comando llega dos veces, la respuesta es la misma.
 */
final class ReservaDeStock
{
    /** @param list<LineaReservada> $lineas en el mismo orden del comando */
    private function __construct(
        public readonly string $pedidoId,
        private EstadoReserva $estado,
        private array $lineas,
        public readonly ?string $motivo,
    ) {
    }

    /** @param list<LineaReservada> $lineas */
    public static function reservada(string $pedidoId, array $lineas): self
    {
        return new self($pedidoId, EstadoReserva::RESERVADA, $lineas, null);
    }

    public static function rechazada(string $pedidoId, string $motivo): self
    {
        return new self($pedidoId, EstadoReserva::RECHAZADA, [], $motivo);
    }

    /** @param list<LineaReservada> $lineas */
    public static function rehidratar(string $pedidoId, EstadoReserva $estado, array $lineas, ?string $motivo): self
    {
        return new self($pedidoId, $estado, $lineas, $motivo);
    }

    public function estado(): EstadoReserva
    {
        return $this->estado;
    }

    /** @return list<LineaReservada> */
    public function lineas(): array
    {
        return $this->lineas;
    }

    /** Solo una reserva vigente tiene stock que devolver; liberar dos veces no hace nada. */
    public function tieneStockPorDevolver(): bool
    {
        return $this->estado === EstadoReserva::RESERVADA;
    }

    public function liberar(): void
    {
        if ($this->estado === EstadoReserva::RESERVADA) {
            $this->estado = EstadoReserva::LIBERADA;
        }
    }
}
