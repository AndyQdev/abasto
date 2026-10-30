<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\Puertos\CuentasDeAcceso;

/** Keycloak de mentira: guarda las cuentas creadas y rechaza un correo repetido. */
final class CuentasEnMemoria implements CuentasDeAcceso
{
    /** @var array<string, array{clave: string, nombre: string, apellido: string, orgId: string, orgNombre: string, rol: string}> */
    public array $cuentas = [];

    public function crear(string $correo, string $clave, string $nombre, string $apellido, string $orgId, string $orgNombre, string $rol): void
    {
        if (isset($this->cuentas[$correo])) {
            throw new ErrorDeDominio('CORREO_EN_USO', 'Ya hay una cuenta con ese correo');
        }
        $this->cuentas[$correo] = compact('clave', 'nombre', 'apellido', 'orgId', 'orgNombre', 'rol');
    }
}
