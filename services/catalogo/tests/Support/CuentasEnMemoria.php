<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\Puertos\CuentasDeAcceso;
use Catalogo\Dominio\SesionEmitida;

/** Keycloak de mentira: guarda las cuentas creadas y rechaza un usuario o un correo repetido. */
final class CuentasEnMemoria implements CuentasDeAcceso
{
    /** @var array<string, array{correo: string, clave: string, nombre: string, apellido: string, orgId: string, orgNombre: string, rol: string}> */
    public array $cuentas = [];

    /** @var list<string> */
    public array $sesiones = [];

    /** @var list<string> */
    public array $apagadas = [];

    public function crear(string $usuario, string $correo, string $clave, string $nombre, string $apellido, string $orgId, string $orgNombre, string $rol): void
    {
        $correoRepetido = in_array($correo, array_column($this->cuentas, 'correo'), true);
        if (isset($this->cuentas[$usuario]) || $correoRepetido) {
            throw new ErrorDeDominio('CORREO_EN_USO', 'Ya hay una cuenta con ese correo');
        }
        $this->cuentas[$usuario] = compact('correo', 'clave', 'nombre', 'apellido', 'orgId', 'orgNombre', 'rol');
    }

    public function activar(string $usuario, bool $activa): void
    {
        $this->apagadas = array_values(array_diff($this->apagadas, [$usuario]));
        if (!$activa) {
            $this->apagadas[] = $usuario;
        }
    }

    public function conRol(string $rol): array
    {
        return [];
    }

    public function sesionPara(string $usuario): SesionEmitida
    {
        if (!isset($this->cuentas[$usuario])) {
            throw new ErrorDeDominio('SIN_CUENTA', 'No hay cuenta');
        }
        $this->sesiones[] = $usuario;

        return new SesionEmitida("acceso-{$usuario}", "renovacion-{$usuario}", 900);
    }
}
