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
        /** Lo que el admin revisa antes de verificar a un mayorista que se registró solo */
        public ?string $representante = null,
        public ?string $telefono = null,
        public ?string $correo = null,
        /** Por qué Abasto lo rechazó; el Panel se lo muestra al mayorista */
        public ?string $motivoRechazo = null,
        /** Fecha y hora del registro (ISO 8601); null en las de la semilla */
        public ?string $registradaEn = null,
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

        return self::con($this, EstadoVerificacion::VERIFICADO, null);
    }

    /** Devuelve una organización nueva en RECHAZADO, con el motivo que verá el mayorista. */
    public function rechazar(?string $motivo = null): self
    {
        return self::con($this, EstadoVerificacion::RECHAZADO, $motivo);
    }

    private static function con(Organizacion $o, EstadoVerificacion $verificacion, ?string $motivo): self
    {
        return new self(
            $o->id, $o->nombre, $o->tipo, $o->ciudad, $verificacion, $o->nit, $o->deLaCasa,
            $o->representante, $o->telefono, $o->correo, $motivo, $o->registradaEn,
        );
    }
}
