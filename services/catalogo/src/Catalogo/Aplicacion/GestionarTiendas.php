<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Puertos\CuentasDeAcceso;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;

/**
 * Superadmin › Tiendas: Abasto mira quién compra y puede suspender una cuenta.
 * Una tienda suspendida no puede volver a entrar (su cuenta de Keycloak queda apagada) y sus pedidos nuevos se
 * rechazan al reservar stock, con el motivo; lo que ya está en camino sigue su curso.
 */
final readonly class GestionarTiendas
{
    public function __construct(
        private OrganizacionRepositorio $organizaciones,
        private CuentasDeAcceso $cuentas,
    ) {
    }

    /** @return list<Organizacion> */
    public function listar(?string $busqueda = null): array
    {
        return $this->organizaciones->tiendas($busqueda);
    }

    public function suspender(string $id, string $motivo): Organizacion
    {
        $motivo = trim($motivo);
        if (mb_strlen($motivo) < 3) {
            throw new ErrorDeDominio('FALTA_MOTIVO', 'Escribe por qué se suspende');
        }
        $tienda = $this->tienda($id)->suspender($motivo);
        $this->organizaciones->guardar($tienda);
        $this->apagarOPrender($tienda, false);

        return $tienda;
    }

    public function reactivar(string $id): Organizacion
    {
        $tienda = $this->tienda($id)->reactivar();
        $this->organizaciones->guardar($tienda);
        $this->apagarOPrender($tienda, true);

        return $tienda;
    }

    private function tienda(string $id): Organizacion
    {
        $tienda = $this->organizaciones->porId($id);
        if ($tienda === null || $tienda->esMayorista()) {
            throw new ErrorDeDominio('TIENDA_NO_EXISTE', 'Esa tienda no existe');
        }

        return $tienda;
    }

    /** El usuario de un cliente de la app es su celular; el de una cuenta con correo, el correo. */
    private function apagarOPrender(Organizacion $tienda, bool $activa): void
    {
        $usuario = $tienda->telefono ?? $tienda->correo;
        if ($usuario !== null) {
            $this->cuentas->activar($usuario, $activa);
        }
    }
}
