<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Organizacion;

interface OrganizacionRepositorio
{
    public function porId(string $id): ?Organizacion;

    /** @return list<Organizacion> */
    public function mayoristas(?string $busqueda = null): array;

    /**
     * Superadmin: las tiendas, las registradas más recientemente primero.
     *
     * @return list<Organizacion>
     */
    public function tiendas(?string $busqueda = null): array;

    public function guardar(Organizacion $organizacion): void;

    public function porNit(string $nit): ?Organizacion;

    /** El cliente de la app que entra con ese celular (591 + 8 dígitos). */
    public function porTelefono(string $telefono): ?Organizacion;

    /**
     * Mayoristas en ese estado, los registrados más recientemente primero.
     *
     * @return list<Organizacion>
     */
    public function mayoristasPorVerificacion(EstadoVerificacion $estado): array;
}
