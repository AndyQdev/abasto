<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * Entidad: el vínculo entre una tienda y un mayorista. Es el corazón de la red privada:
 * sin una relación aprobada, la tienda no ve los precios de ese mayorista.
 */
final class RelacionComercial
{
    public function __construct(
        public readonly string $tiendaId,
        public readonly string $mayoristaId,
        private EstadoRelacion $estado,
        private ?ListaDePrecios $lista = null,
    ) {
        if ($tiendaId === $mayoristaId) {
            throw new ErrorDeDominio('RELACION_CONSIGO_MISMO', 'Una empresa no puede ser cliente de sí misma');
        }
    }

    public static function solicitar(string $tiendaId, string $mayoristaId): self
    {
        return new self($tiendaId, $mayoristaId, EstadoRelacion::SOLICITADA);
    }

    public function aprobar(ListaDePrecios $lista): void
    {
        $this->estado = EstadoRelacion::APROBADA;
        $this->lista = $lista;
    }

    public function rechazar(): void
    {
        $this->estado = EstadoRelacion::RECHAZADA;
        $this->lista = null;
    }

    /** Volver a pedir después de un rechazo está permitido; si ya está aprobada no cambia nada. */
    public function volverASolicitar(): void
    {
        if ($this->estado !== EstadoRelacion::APROBADA) {
            $this->estado = EstadoRelacion::SOLICITADA;
        }
    }

    public function estado(): EstadoRelacion
    {
        return $this->estado;
    }

    public function lista(): ?ListaDePrecios
    {
        return $this->lista;
    }

    public function permiteVerPrecios(): bool
    {
        return $this->estado === EstadoRelacion::APROBADA && $this->lista !== null;
    }
}
