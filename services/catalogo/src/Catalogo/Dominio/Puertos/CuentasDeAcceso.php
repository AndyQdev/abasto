<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\ErrorDeDominio;

/**
 * Donde viven los usuarios que inician sesión (Keycloak). Al registrarse, la persona queda
 * con su empresa (org_id) y su rol, así el token ya trae todo lo que los servicios necesitan.
 */
interface CuentasDeAcceso
{
    /**
     * @param 'mayorista'|'tienda' $rol
     *
     * @throws ErrorDeDominio CORREO_EN_USO si ya hay una cuenta con ese correo
     */
    public function crear(
        string $correo,
        string $clave,
        string $nombre,
        string $apellido,
        string $orgId,
        string $orgNombre,
        string $rol,
    ): void;
}
