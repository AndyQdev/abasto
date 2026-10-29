<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/** Un mayorista o una tienda. El id es el org_id del token de Keycloak. */
final readonly class Organizacion
{
    public function __construct(
        public string $id,
        public string $nombre,
        public string $tipo,
        public string $ciudad,
        public EstadoVerificacion $verificacion = EstadoVerificacion::PENDIENTE,
        public ?string $nit = null,
        /** Abasto mismo vendiendo: cualquier tienda registrada ve sus precios sin pedir ser cliente */
        public bool $deLaCasa = false,
    ) {
    }

    public function esMayorista(): bool
    {
        return $this->tipo === 'mayorista';
    }

    /** La interfaz trata la verificación como sí/no: solo VERIFICADO cuenta. */
    public function estaVerificada(): bool
    {
        return $this->verificacion === EstadoVerificacion::VERIFICADO;
    }

    /** Devuelve una organización nueva en VERIFICADO; una rechazada tiene que pasar antes por pendiente. */
    public function verificar(): self
    {
        if ($this->verificacion === EstadoVerificacion::RECHAZADO) {
            throw new ErrorDeDominio(
                'VERIFICACION_RECHAZADA',
                'Una organización rechazada no puede pasar a verificada sin volver a pendiente',
            );
        }

        return self::con($this, EstadoVerificacion::VERIFICADO);
    }

    /** Devuelve una organización nueva en RECHAZADO. */
    public function rechazar(): self
    {
        return self::con($this, EstadoVerificacion::RECHAZADO);
    }

    private static function con(Organizacion $o, EstadoVerificacion $verificacion): self
    {
        return new self($o->id, $o->nombre, $o->tipo, $o->ciudad, $verificacion, $o->nit, $o->deLaCasa);
    }
}
