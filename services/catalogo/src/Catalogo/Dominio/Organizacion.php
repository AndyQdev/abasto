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
        /** Solo clientes de la app: para qué compra (hogar, tienda o productor). Null si todavía no eligió */
        public ?NegocioDelCliente $negocio = null,
        /** Datos de demostración de `catalogo:semilla` (e2e y casos de uso del parcial): la app no los muestra */
        public bool $dePrueba = false,
        /** Abasto la suspendió desde el Superadmin: no entra ni hace pedidos nuevos */
        public bool $suspendida = false,
        public ?string $motivoSuspension = null,
    ) {
    }

    /** Devuelve la tienda suspendida, con el motivo. */
    public function suspender(string $motivo): self
    {
        return new self(
            $this->id, $this->nombre, $this->tipo, $this->ciudad, $this->verificacion, $this->nit, $this->deLaCasa,
            $this->representante, $this->telefono, $this->correo, $this->motivoRechazo, $this->registradaEn, $this->negocio, $this->dePrueba,
            true, $motivo,
        );
    }

    /** Devuelve la tienda sin suspensión. */
    public function reactivar(): self
    {
        return new self(
            $this->id, $this->nombre, $this->tipo, $this->ciudad, $this->verificacion, $this->nit, $this->deLaCasa,
            $this->representante, $this->telefono, $this->correo, $this->motivoRechazo, $this->registradaEn, $this->negocio, $this->dePrueba,
        );
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

    /** Devuelve la organización con su tipo de negocio. Un mayorista no lo tiene: vende, no compra para su negocio. */
    public function conNegocio(NegocioDelCliente $negocio): self
    {
        if ($this->esMayorista()) {
            throw new ErrorDeDominio('NEGOCIO_SOLO_CLIENTES', 'El tipo de negocio es para los clientes de la app, no para los mayoristas');
        }

        return new self(
            $this->id, $this->nombre, $this->tipo, $this->ciudad, $this->verificacion, $this->nit, $this->deLaCasa,
            $this->representante, $this->telefono, $this->correo, $this->motivoRechazo, $this->registradaEn, $negocio, $this->dePrueba,
            $this->suspendida, $this->motivoSuspension,
        );
    }

    private static function con(Organizacion $o, EstadoVerificacion $verificacion, ?string $motivo): self
    {
        return new self(
            $o->id, $o->nombre, $o->tipo, $o->ciudad, $verificacion, $o->nit, $o->deLaCasa,
            $o->representante, $o->telefono, $o->correo, $motivo, $o->registradaEn, $o->negocio, $o->dePrueba,
            $o->suspendida, $o->motivoSuspension,
        );
    }
}
