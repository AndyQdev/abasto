<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\SesionEmitida;

/**
 * Donde viven los usuarios que inician sesión (Keycloak). Al registrarse, la persona queda
 * con su empresa (org_id) y su rol, así el token ya trae todo lo que los servicios necesitan.
 */
interface CuentasDeAcceso
{
    /**
     * @param string $usuario el correo (Panel) o el celular con código de país (app de clientes)
     * @param 'mayorista'|'tienda' $rol
     *
     * @throws ErrorDeDominio CORREO_EN_USO si ya hay una cuenta con ese usuario o ese correo
     */
    public function crear(
        string $usuario,
        string $correo,
        string $clave,
        string $nombre,
        string $apellido,
        string $orgId,
        string $orgNombre,
        string $rol,
    ): void;

    /**
     * Abre una sesión larga para alguien que ya demostró ser dueño de su celular (código correcto).
     * La app la guarda y la renueva sola: el cliente no vuelve a escribir su número.
     */
    public function sesionPara(string $usuario): SesionEmitida;

    /** Prende o apaga la cuenta (tienda suspendida). Si ese usuario no tiene cuenta, no hace nada. */
    public function activar(string $usuario, bool $activa): void;

    /**
     * Quién tiene el rol. Superadmin › Usuarios.
     *
     * @return list<array{usuario: string, nombre: string, correo: ?string, activo: bool}>
     */
    public function conRol(string $rol): array;
}
